// @flow
import React from 'react'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import {Set} from 'immutable'
import {storiesOf} from '../../stories/storybook'
import FollowNotification, {type Props} from '.'
import moment from 'moment'

const store = {
  config: {
    following: Set(['max', 'cnojima', 'cdixon']),
    you: 'ayoubd',
  },
}

const singleFollowProps1: Props = {
  newFollows: [{username: 'mmaxim'}],
  badged: true,
  notificationTime: new Date(),
}

const singleFollowProps2: Props = {
  newFollows: [{username: 'max'}],
  badged: false,
  notificationTime: moment()
    .subtract(3, 'days')
    .toDate(),
}

const multiFollowProps1: Props = {
  newFollows: [{username: 'max'}, {username: 'mmaxim'}, {username: 'chrisnojima'}],
  badged: true,
  notificationTime: moment()
    .subtract(3, 'weeks')
    .toDate(),
  numAdditional: 0,
}

const multiFollowProps2: Props = {
  newFollows: [{username: 'max'}, {username: 'mmaxim'}, {username: 'chrisnojima'}, {username: 'chris'}],
  badged: false,
  notificationTime: moment()
    .subtract(3, 'months')
    .toDate(),
  numAdditional: 5,
}

const load = () => {
  storiesOf('People/Follow notification', module)
    .addDecorator(story => <Provider store={createStore(ignore => store, store)}>{story()}</Provider>)
    .add('Someone followed you', () => <FollowNotification {...singleFollowProps1} />)
    .add('Someone you follow followed you', () => <FollowNotification {...singleFollowProps2} />)
    .add('A few people followed you', () => <FollowNotification {...multiFollowProps1} />)
    .add('Many people followed you', () => <FollowNotification {...multiFollowProps2} />)
}

export default load
