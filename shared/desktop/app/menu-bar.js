// @flow
import menubar from 'menubar'
import {injectReactQueryParams} from '../../util/dev'
import {screen as electronScreen, ipcMain, systemPreferences, app} from 'electron'
import {isDarwin, isWindows, isLinux} from '../../constants/platform'
import {resolveImage, resolveRootAsURL} from '../resolve-root'

import type {BadgeType} from '../../constants/types/notifications'

let iconType: BadgeType = 'regular'

const isDarkMode = () => isDarwin && systemPreferences && systemPreferences.isDarkMode()

const getIcon = invertColors => {
  const devMode = __DEV__ ? '-dev' : ''
  let color = 'white'
  let platform = ''

  if (isDarwin) {
    color = isDarkMode() ? 'white' : 'black'
  } else if (isWindows) {
    color = 'black'
    platform = 'windows-'
  }

  const size = isWindows ? 16 : 22

  color = invertColors ? {black: 'white', white: 'black'}[color] : color

  return resolveImage(
    'menubarIcon',
    `icon-${platform}keybase-menubar-${iconType}-${color}-${size}${devMode}@2x.png`
  )
}

export default function(menubarWindowIDCallback: (id: number) => void) {
  const mb = menubar({
    index: resolveRootAsURL('renderer', injectReactQueryParams('renderer.html?menubar')),
    width: 320,
    height: 350,
    resizable: false,
    hasShadow: true,
    transparent: true,
    preloadWindow: true,
    icon: getIcon(false),
    // Without this flag set, menubar will hide the dock icon when the app
    // ready event fires. We manage the dock icon ourselves, so this flag
    // prevents menubar from changing the state.
    showDockIcon: true,
  })

  const updateIcon = invertColors => {
    mb.tray.setImage(getIcon(invertColors))
  }

  if (isDarwin && systemPreferences && systemPreferences.subscribeNotification) {
    systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
      updateIcon(false)
    })
  }

  ipcMain.on('showTray', (event, type, count) => {
    iconType = type
    updateIcon(false)
    if (app.dock && app.dock.isVisible()) {
      app.setBadgeCount(count)
    }
  })

  mb.on('ready', () => {
    menubarWindowIDCallback(mb.window.id)
    // Hack: open widget when left/right/double clicked
    mb.tray.on('right-click', (e, bounds) => {
      e.preventDefault()
      setImmediate(() => mb.tray.emit('click', {...e}, {...bounds}))
    })
    mb.tray.on('double-click', e => e.preventDefault())

    // prevent the menubar's window from dying when we quit
    // We remove any existing listeners to close because menubar has one that deletes the reference to mb.window
    mb.window.removeAllListeners('close')
    mb.window.on('close', event => {
      event.preventDefault()
      mb.hideWindow()
    })

    if (isLinux) {
      mb.tray.setToolTip('Show Keybase')
    }

    mb.on('show', () => {
      // Account for different taskbar positions on Windows
      if (isWindows) {
        const cursorPoint = electronScreen.getCursorScreenPoint()
        const screenSize = electronScreen.getDisplayNearestPoint(cursorPoint).workArea
        if (screenSize.x > 0) {
          // start menu on left
          mb.setOption('windowPosition', 'trayBottomLeft')
        } else if (screenSize.y > 0) {
          // start menu on top
          mb.setOption('windowPosition', 'trayRight')
        } else if (cursorPoint.x > screenSize.x) {
          // start menu on right
          mb.setOption('windowPosition', 'bottomRight')
        } else {
          // start menu on bottom
          mb.setOption('windowPosition', 'trayBottomCenter')
        }
      }

      isDarwin && updateIcon(!isDarkMode())
    })
    mb.on('hide', () => {
      isDarwin && updateIcon(false)
    })
    mb.on('after-show', () => {
      console.log('Showing menubar at', mb.window && mb.window.getBounds())
    })
    mb.tray.on('click', (e, bounds) => {
      console.log('Clicked tray icon:', bounds)
    })
  })

  // Work around an OS X bug that leaves a gap in the status bar if you exit
  // without removing your status bar icon.
  if (isDarwin) {
    mb.app.on('before-quit', () => {
      mb.tray && mb.tray.destroy()
    })
  }
}
