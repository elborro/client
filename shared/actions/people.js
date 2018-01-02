// @flow
import * as PeopleGen from './people-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as Constants from '../constants/people'
import * as Types from '../constants/types/people'
import * as RouteTypes from '../constants/types/route-tree'
import * as RouteConstants from '../constants/route-tree'
import * as RPCTypes from '../constants/types/rpc-gen'
import {peopleTab} from '../constants/tabs'
import {type TypedState} from '../constants/reducer'

const _getPeopleData = function(action: PeopleGen.GetPeopleDataPayload, state: TypedState) {
  return Saga.all([
    Saga.call(RPCTypes.homeHomeGetScreenRpcPromise, {
      markViewed: action.payload.markViewed,
      numFollowSuggestionsWanted: action.payload.numFollowSuggestionsWanted,
    }),
    Saga.identity(state.config.following),
    Saga.identity(state.config.followers),
  ])
}

const _processPeopleData = function([
  data: RPCTypes.HomeScreen,
  following: I.Set<string>,
  followers: I.Set<string>,
]) {
  let oldItems: I.List<Types.PeopleScreenItem> = I.List()
  let newItems: I.List<Types.PeopleScreenItem> = I.List()
  if (data.items) {
    data.items.forEach(item => {
      const badged = item.badged
      if (item.data.t === RPCTypes.homeHomeScreenItemType.todo) {
        // Todo item
        const todoType = Constants.todoTypeEnumToType[(item.data.todo && item.data.todo.t) || 0]
        newItems = newItems.push(
          Constants.makeTodo({
            type: 'todo',
            badged: true, // todo items are always badged
            todoType,
            instructions: Constants.todoTypeToInstructions[todoType],
            confirmLabel: Constants.todoTypeToConfirmLabel[todoType],
            dismissable: Constants.todoTypeToDismissable[todoType],
            icon: Constants.todoTypeToIcon[todoType],
          })
        )
      } else if (item.data.t === RPCTypes.homeHomeScreenItemType.people) {
        // Follow notification
        const notification = item.data.people
        if (notification && notification.t === RPCTypes.homeHomeScreenPeopleNotificationType.followed) {
          // Single follow notification
          const follow = notification.followed
          if (!follow) {
            return
          }
          const item = Constants.makeFollowedNotificationItem({
            type: 'notification',
            newFollows: [Constants.makeFollowedNotification({username: follow.user.username})],
            notificationTime: new Date(follow.followTime),
            badged,
          })
          badged ? (newItems = newItems.push(item)) : (oldItems = oldItems.push(item))
        } else if (
          notification &&
          notification.t === RPCTypes.homeHomeScreenPeopleNotificationType.followedMulti
        ) {
          // Multiple follows notification
          const multiFollow = notification.followedMulti
          if (!multiFollow) {
            return
          }
          const followers = multiFollow.followers
          if (!followers) {
            return
          }
          const notificationTimes = followers.map(follow => follow.followTime)
          const maxNotificationTime = Math.max(...notificationTimes)
          const notificationTime = new Date(maxNotificationTime)
          const item = Constants.makeFollowedNotificationItem({
            type: 'notification',
            newFollows: followers.map(follow =>
              Constants.makeFollowedNotification({
                username: follow.user.username,
              })
            ),
            notificationTime,
            badged,
            numAdditional: multiFollow.numOthers,
          })
          badged ? (newItems = newItems.push(item)) : (oldItems = oldItems.push(item))
        }
      }
    })
  }
  let followSuggestions: I.List<Types.FollowSuggestion> = I.List()
  if (data.followSuggestions) {
    data.followSuggestions.forEach(suggestion => {
      const followsMe = followers.has(suggestion.username)
      const iFollow = following.has(suggestion.username)
      followSuggestions = followSuggestions.push(
        Constants.makeFollowSuggestion({
          username: suggestion.username,
          followsMe,
          iFollow,
          fullName: suggestion.fullName,
        })
      )
    })
  }
  return Saga.put(
    PeopleGen.createPeopleDataProcessed({
      oldItems,
      newItems,
      lastViewed: new Date(data.lastViewed),
      followSuggestions,
    })
  )
}

const _skipTodo = (action: PeopleGen.SkipTodoPayload) => {
  return Saga.sequentially([
    Saga.call(RPCTypes.homeHomeSkipTodoTypeRpcPromise, {
      t: RPCTypes.homeHomeScreenTodoType[action.payload.type],
    }),
    Saga.put(
      PeopleGen.createGetPeopleData({
        markViewed: true,
        numFollowSuggestionsWanted: Constants.DEFAULT_FOLLOW_SUGGESTIONS_QUANT,
      })
    ),
  ])
}

let _wasOnPeopleTab = false
const _onTabChange = (action: RouteTypes.SwitchTo) => {
  // TODO replace this with notification based refreshing
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root !== peopleTab) {
    _wasOnPeopleTab = false
  } else if (root === peopleTab && !_wasOnPeopleTab) {
    _wasOnPeopleTab = true
    return Saga.put(
      PeopleGen.createGetPeopleData({
        markViewed: true,
        numFollowSuggestionsWanted: Constants.DEFAULT_FOLLOW_SUGGESTIONS_QUANT,
      })
    )
  }
}

const peopleSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatestPure(PeopleGen.getPeopleData, _getPeopleData, _processPeopleData)
  yield Saga.safeTakeEveryPure(PeopleGen.skipTodo, _skipTodo)
  yield Saga.safeTakeEveryPure(RouteConstants.switchTo, _onTabChange)
}

export default peopleSaga
