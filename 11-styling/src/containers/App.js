import React from 'react';
import find from 'lodash/find';
import isEqual from 'lodash/isEqual';
import 'whatwg-fetch';

import EmailList from '../components/EmailList';
import EmailView from '../components/EmailView';
import EmailForm from '../components/EmailForm';

import './App.scss';

const EmailViewWrapper = ({selectedEmail, onClose, onDelete, onMarkUnread, onMarkRead}) => {
    let component = null;

    if (selectedEmail) {
        component = (
            <article className="app__view">
                <EmailView
                    email={selectedEmail}
                    onClose={onClose}
                    onDelete={onDelete}
                    onMarkUnread={onMarkUnread}
                    onMarkRead={onMarkRead}
                />
            </article>
        );
    }

    return component;
};

export default class EmailApp extends React.Component {
    static propTypes = {
        pollInterval: React.PropTypes.number
    }

    static defaultProps = {
        pollInterval: 2000
    }

    state = {
        emails: [],
        selectedEmailId: -1
    }

    componentDidMount() {
        // Retrieve emails from server once we know DOM exists
        this._getUpdateEmails();

        // Set up long-polling to continuously get new data
        this._pollId = setInterval(
            () => this._getUpdateEmails(),
            this.props.pollInterval
        );
    }

    componentWillUnmount() {
        // Need to remember to clearInterval when the component gets
        // removed from the DOM, otherwise the interval will keep going
        // forever and leak memory
        clearInterval(this._pollId);
    }

    _getUpdateEmails() {
        return fetch('http://localhost:9090/emails')
            .then((res) => res.json())
            .then((emails) => {
                // Because `emails` is a different reference from `this.state.emails`,
                // the component will unnecessarily re-render even though the contents
                // are the same. The virtual DOM will prevent the actual DOM from updating
                // but it still actually has to run its diffing algorithm. So instead
                // making this quick check here, saves unnecessary extra work
                if (!isEqual(emails, this.state.emails)) {
                    this.setState({emails});
                }
            })
            .catch((ex) => console.error(ex));
    }

    _setUnread(emailId, unread=true) {
        // Make a PUT request to update unread state
        fetch(`//localhost:9090/emails/${emailId}`, {
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({unread})
        })
            .then((res) => res.json())

            // optimistic updating (see _handleFormSubmit for more info)
            .then(({success}) => {
                if (success) {
                    let emails = this.state.emails.map((email) => (
                        email.id === emailId
                            ? {...email, unread}
                            : email
                    ));

                    this.setState({emails});
                }
                else {
                    throw new Error(`Unable to set email ID# ${emailId} unread state to ${unread}.`);
                }
            })

            .catch((ex) => console.error(ex));
    }

    _handleItemSelect(emailId) {
        // update state (so that the EmailView will show)
        this.setState({selectedEmailId: emailId});

        if (this.state.selectedEmailId !== emailId) {
            // also mark the email as read
            this._setUnread(emailId, false);
        }
    }

    _handleEmailViewClose() {
        // We close the email view by resetting the selected email
        this.setState({selectedEmailId: -1});
    }

    _handleFormSubmit(newEmail) {
        // Make a JSON POST with the new email
        fetch('//localhost:9090/emails', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newEmail)
        })
            .then((res) => res.json())
            .then(({success}) => {
                if (success) {
                    // if the email was successfully updated, we have to make
                    // a request to get the new list of emails, but we'll have
                    // to wait for the response of that request, so let's add to
                    // our state immediately and then later when the response
                    // comes back, the server-side list will update. This is mainly
                    // here to demonstrate immutable updating of data structures

                    // Create a full email info by spreading in `id`, `date` & `unread`
                    // Then spread to front of emails state (since it's the newest)
                    let emails = [
                        {
                            ...newEmail,
                            id: Date.now(),
                            date: `${new Date()}`,
                            unread: true
                        },
                        ...this.state.emails
                    ];

                    // Set state with new updated emails list
                    this.setState({emails});
                }
                else {
                    throw new Error('Unable to send email!');
                }
            })
            .catch((ex) => console.error(ex));
    }

    _handleItemDelete(emailId) {
        // Make a DELETE request
        fetch(`//localhost:9090/emails/${emailId}`, {
            method: 'DELETE'
        })
            .then((res) => res.json())

            // optimistic updating (see _handleFormSubmit for more info)
            .then(({success}) => {
                if (success) {
                    let emails = this.state.emails.filter((email) => email.id !== emailId);

                    // Also reset `selectedEmailId` since we're deleting it
                    this.setState({emails, selectedEmailId: -1});
                }
                else {
                    throw new Error(`Unable to delete email ID# ${emailId}.`);
                }
            })
            .catch((ex) => console.error(ex));
    }

    _handleItemMarkUnread(emailId) {
        this._setUnread(emailId);
    }

    _handleItemMarkRead(emailId) {
        this._setUnread(emailId, false);
    }

    render() {
        let {emails, selectedEmailId} = this.state;
        let selectedEmail = find(emails, (email) => email.id === selectedEmailId);

        return (
            <main className="app">
                <div className="app__page">
                    <section className="app__list">
                        <EmailList
                            emails={emails}
                            onItemSelect={this._handleItemSelect.bind(this)}
                            onItemDelete={this._handleItemDelete.bind(this)}
                            onItemMarkUnread={this._handleItemMarkUnread.bind(this)}
                            selectedEmailId={selectedEmailId}
                        />
                    </section>
                    <EmailViewWrapper selectedEmail={selectedEmail}
                        onClose={this._handleEmailViewClose.bind(this)}
                        onDelete={this._handleItemDelete.bind(this, selectedEmailId)}
                        onMarkUnread={this._handleItemMarkUnread.bind(this, selectedEmailId)}
                        onMarkRead={this._handleItemMarkRead.bind(this, selectedEmailId)}
                    />
                    <div className="app__form">
                        <EmailForm onSubmit={this._handleFormSubmit.bind(this)} />
                    </div>
                </div>
            </main>
        );
    }
}
