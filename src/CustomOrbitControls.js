/**
* @author qiao / https://github.com/qiao
* @author mrdoob / http://mrdoob.com
* @author alteredq / http://alteredqualia.com/
* @author WestLangley / http://github.com/WestLangley
* @author erich666 / http://erichaines.com
* @author ScieCode / http://github.com/sciecode
*/

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
// This is very similar to OrbitControls, another set of touch behavior
//
//    Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - left mouse, or arrow keys / touch: one-finger move

import * as THREE from 'three'

export function OrbitControls (object, domElement) {
  if (domElement === undefined) console.warn('THREE.OrbitControls: The second parameter "domElement" is now mandatory.')
  if (domElement === document) console.error('THREE.OrbitControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.')

  this.object = object
  this.domElement = domElement

  // Set to false to disable this control
  this.enabled = true

  // "target" sets the location of focus, where the object orbits around
  this.target = new THREE.Vector3()

  // How far you can dolly in and out ( PerspectiveCamera only )
  this.minDistance = 0
  this.maxDistance = Infinity

  // How far you can zoom in and out ( OrthographicCamera only )
  this.minZoom = 0
  this.maxZoom = Infinity

  // How far you can orbit vertically, upper and lower limits.
  // Range is 0 to Math.PI radians.
  this.minPolarAngle = 0 // radians
  this.maxPolarAngle = Math.PI // radians

  // How far you can orbit horizontally, upper and lower limits.
  // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
  this.minAzimuthAngle = -Infinity // radians
  this.maxAzimuthAngle = Infinity // radians

  // Set to true to enable damping (inertia)
  // If damping is enabled, you must call controls.update() in your animation loop
  this.enableDamping = false
  this.dampingFactor = 0.05

  // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
  // Set to false to disable zooming
  this.enableZoom = true
  this.zoomSpeed = 1.0

  // Set to false to disable rotating
  this.enableRotate = true
  this.rotateSpeed = 1.0

  // Set to false to disable panning
  this.enablePan = true
  this.panSpeed = 1.0
  this.screenSpacePanning = false // if true, pan in screen-space
  this.keyPanSpeed = 7.0 // pixels moved per arrow key push

  // Set to true to automatically rotate around the target
  // If auto-rotate is enabled, you must call controls.update() in your animation loop
  this.autoRotate = false
  this.autoRotateSpeed = 2.0 // 30 seconds per round when fps is 60

  // Set to false to disable use of the keys
  this.enableKeys = true

  // https://css-tricks.com/snippets/javascript/javascript-keycodes/
  this.keys = {
    LEFT: 65, // A
    RIGHT: 68, // D
    BOTTOM: 81, // Q
    UP: 69, // E
    OUT: 83, // S
    IN: 87, // W
    LEFTARROW: 37,
    UPARROW: 38,
    RIGHTARROW: 39,
    DOWNARROW: 40
  }

  // Mouse buttons
  this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }

  // Touch fingers
  this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }

  // for reset
  this.target0 = this.target.clone()
  this.position0 = this.object.position.clone()
  this.zoom0 = this.object.zoom

  //
  // public methods
  //

  this.getPolarAngle = function () {
    return spherical.phi
  }

  this.getAzimuthalAngle = function () {
    return spherical.theta
  }

  this.saveState = function () {
    scope.target0.copy(scope.target)
    scope.position0.copy(scope.object.position)
    scope.zoom0 = scope.object.zoom
  }

  this.reset = function () {
    scope.target.copy(scope.target0)
    scope.object.position.copy(scope.position0)
    scope.object.zoom = scope.zoom0
    scope.object.updateProjectionMatrix()
    scope.dispatchEvent(changeEvent)
    scope.update()
    state = STATE.NONE
  }

  // this method is exposed, but perhaps it would be better if we can make it private...
  this.update = (function () {
    const offset = new THREE.Vector3()

    // so camera.up is the orbit axis
    const quat = new THREE.Quaternion().setFromUnitVectors(object.up, new THREE.Vector3(0, 1, 0))
    const quatInverse = quat.clone().inverse()

    const lastPosition = new THREE.Vector3()
    const lastQuaternion = new THREE.Quaternion()

    return function update () {
      const position = scope.object.position

      offset.copy(position).sub(scope.target)

      // rotate offset to "y-axis-is-up" space
      offset.applyQuaternion(quat)

      // angle from z-axis around y-axis
      spherical.setFromVector3(offset)

      if (scope.autoRotate && state === STATE.NONE) {
        rotateLeft(getAutoRotationAngle())
      }

      if (scope.enableDamping) {
        spherical.theta += sphericalDelta.theta * scope.dampingFactor
        spherical.phi += sphericalDelta.phi * scope.dampingFactor
      } else {
        spherical.theta += sphericalDelta.theta
        spherical.phi += sphericalDelta.phi
      }

      // restrict theta to be between desired limits
      spherical.theta = Math.max(scope.minAzimuthAngle, Math.min(scope.maxAzimuthAngle, spherical.theta))

      // restrict phi to be between desired limits
      spherical.phi = Math.max(scope.minPolarAngle, Math.min(scope.maxPolarAngle, spherical.phi))
      spherical.makeSafe()
      spherical.radius *= scale

      // restrict radius to be between desired limits
      spherical.radius = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius))

      // move target to panned location
      if (scope.enableDamping === true) {
        scope.target.addScaledVector(panOffset, scope.dampingFactor)
      } else {
        scope.target.add(panOffset)
      }

      offset.setFromSpherical(spherical)

      // rotate offset back to "camera-up-vector-is-up" space
      offset.applyQuaternion(quatInverse)
      position.copy(scope.target).add(offset)

      scope.object.lookAt(scope.target)

      if (scope.enableDamping === true) {
        sphericalDelta.theta *= (1 - scope.dampingFactor)
        sphericalDelta.phi *= (1 - scope.dampingFactor)
        panOffset.multiplyScalar(1 - scope.dampingFactor)
      } else {
        sphericalDelta.set(0, 0, 0)
        panOffset.set(0, 0, 0)
      }

      scale = 1

      // update condition is:
      // min(camera displacement, camera rotation in radians)^2 > EPS
      // using small-angle approximation cos(x/2) = 1 - x^2 / 8

      if (zoomChanged ||
                lastPosition.distanceToSquared(scope.object.position) > EPS ||
                8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS) {
        scope.dispatchEvent(changeEvent)
        lastPosition.copy(scope.object.position)
        lastQuaternion.copy(scope.object.quaternion)
        zoomChanged = false
        return true
      }

      return false
    }
  }())

  this.dispose = function () {
    scope.domElement.removeEventListener('contextmenu', onContextMenu, false)
    scope.domElement.removeEventListener('mousedown', onMouseDown, false)
    scope.domElement.removeEventListener('wheel', onMouseWheel, false)
    scope.domElement.removeEventListener('touchstart', onTouchStart, false)
    scope.domElement.removeEventListener('touchend', onTouchEnd, false)
    scope.domElement.removeEventListener('touchmove', onTouchMove, false)
    document.removeEventListener('mousemove', onMouseMove, false)
    document.removeEventListener('mouseup', onMouseUp, false)
    scope.domElement.removeEventListener('keydown', onKeyDown, false)
    // scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
  }

  //
  // internals
  //

  const scope = this

  const changeEvent = { type: 'change' }
  const startEvent = { type: 'start' }
  const endEvent = { type: 'end' }

  const STATE = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_PAN: 4,
    TOUCH_DOLLY_PAN: 5,
    TOUCH_DOLLY_ROTATE: 6
  }

  let state = STATE.NONE

  const EPS = 0.000001

  // current position in spherical coordinates
  const spherical = new THREE.Spherical()
  const sphericalDelta = new THREE.Spherical()

  let scale = 1
  const panOffset = new THREE.Vector3()
  let zoomChanged = false

  const rotateStart = new THREE.Vector2()
  const rotateEnd = new THREE.Vector2()
  const rotateDelta = new THREE.Vector2()

  const panStart = new THREE.Vector2()
  const panEnd = new THREE.Vector2()
  const panDelta = new THREE.Vector2()

  const dollyStart = new THREE.Vector2()
  const dollyEnd = new THREE.Vector2()
  const dollyDelta = new THREE.Vector2()

  function getAutoRotationAngle () {
    return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed
  }

  function getZoomScale () {
    return Math.pow(0.95, scope.zoomSpeed)
  }

  function rotateLeft (angle) {
    sphericalDelta.theta -= angle
  }

  function rotateUp (angle) {
    sphericalDelta.phi -= angle
  }

  const panForward = (function () {
    const v = new THREE.Vector3()
    return function panForward (distance, objectMatrix) {
      v.setFromMatrixColumn(objectMatrix, 2) // get Y column of objectMatrix
      v.multiplyScalar(-distance * 0.25) // 0.25 fudge factor
      panOffset.add(v)
    }
  }())

  const panLeft = (function () {
    const v = new THREE.Vector3()
    return function panLeft (distance, objectMatrix) {
      v.setFromMatrixColumn(objectMatrix, 0) // get X column of objectMatrix
      v.multiplyScalar(-distance)
      panOffset.add(v)
    }
  }())

  const panUp = (function () {
    const v = new THREE.Vector3()

    return function panUp (distance, objectMatrix) {
      if (scope.screenSpacePanning === true) {
        v.setFromMatrixColumn(objectMatrix, 1)
      } else {
        v.setFromMatrixColumn(objectMatrix, 0)
        v.crossVectors(scope.object.up, v)
      }

      v.multiplyScalar(distance)
      panOffset.add(v)
    }
  }())

  // deltaX and deltaY are in pixels; right and down are positive
  const pan = (function () {
    const offset = new THREE.Vector3()

    return function pan (deltaX, deltaY) {
      const element = scope.domElement

      if (scope.object.isPerspectiveCamera) {
        // perspective
        const position = scope.object.position
        offset.copy(position).sub(scope.target)
        let targetDistance = offset.length()

        // half of the fov is center to top of screen
        targetDistance *= Math.tan((scope.object.fov / 2) * Math.PI / 180.0)

        // we use only clientHeight here so aspect ratio does not distort speed
        panLeft(2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix)
        panUp(2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix)
      } else if (scope.object.isOrthographicCamera) {
        // orthographic
        panLeft(deltaX * (scope.object.right - scope.object.left) / scope.object.zoom / element.clientWidth, scope.object.matrix)
        panUp(deltaY * (scope.object.top - scope.object.bottom) / scope.object.zoom / element.clientHeight, scope.object.matrix)
      } else {
        // camera neither orthographic nor perspective
        console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.')
        scope.enablePan = false
      }
    }
  }())

  function dollyOut (dollyScale) {
    if (scope.object.isPerspectiveCamera) {
      panForward(-dollyScale, scope.object.matrix)
    } else if (scope.object.isOrthographicCamera) {
      scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom * dollyScale))
      scope.object.updateProjectionMatrix()
      zoomChanged = true
    } else {
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.')
      scope.enableZoom = false
    }
  }

  function dollyIn (dollyScale) {
    if (scope.object.isPerspectiveCamera) {
      panForward(dollyScale, scope.object.matrix)
    } else if (scope.object.isOrthographicCamera) {
      scope.object.zoom = Math.max(scope.minZoom, Math.min(scope.maxZoom, scope.object.zoom / dollyScale))
      scope.object.updateProjectionMatrix()
      zoomChanged = true
    } else {
      console.warn('WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.')
      scope.enableZoom = false
    }
  }

  //
  // event callbacks - update the object state
  //

  function handleMouseDownRotate (event) {
    rotateStart.set(event.clientX, event.clientY)
  }

  function handleMouseDownDolly (event) {
    dollyStart.set(event.clientX, event.clientY)
  }

  function handleMouseDownPan (event) {
    panStart.set(event.clientX, event.clientY)
  }

  function handleMouseMoveRotate (event) {
    // FPS controls
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    const PI_2 = Math.PI / 2
    euler.setFromQuaternion(scope.object.quaternion)
    euler.y -= movementX * 0.002
    euler.x -= movementY * 0.002
    euler.x = Math.max(PI_2 - scope.maxPolarAngle, Math.min(PI_2 - scope.minPolarAngle, euler.x))
    const q = new THREE.Quaternion()

    q.setFromEuler(euler)
    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(q)
    const dist = scope.object.position.distanceTo(scope.target)
    if (dist > 0.001) { forward.multiplyScalar(dist) }
    scope.target.copy(forward)
    scope.update()

    /*
        // Old Orbit controls
        rotateEnd.set(event.clientX, event.clientY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        const element = scope.domElement;
        rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight); // yes, height
        rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
        */
  }

  function handleMouseMoveDolly (event) {
    dollyEnd.set(event.clientX, event.clientY)
    dollyDelta.subVectors(dollyEnd, dollyStart)

    if (dollyDelta.y > 0) {
      dollyIn(getZoomScale())
    } else if (dollyDelta.y < 0) {
      dollyOut(getZoomScale())
    }

    dollyStart.copy(dollyEnd)
    scope.update()
  }

  function handleMouseMovePan (event) {
    panEnd.set(event.clientX, event.clientY)
    panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed)
    pan(panDelta.x, panDelta.y)
    panStart.copy(panEnd)
    scope.update()
  }

  function handleMouseUp (/* event */) {
    // no-op
  }

  function handleMouseWheel (event) {
    const mouseWheelMultiplier = 2
    if (event.deltaY < 0) {
      dollyIn(getZoomScale() * mouseWheelMultiplier)
    } else if (event.deltaY > 0) {
      dollyOut(getZoomScale() * mouseWheelMultiplier)
    }
    scope.update()
  }

  function handleKeyDown (event) {
    let needsUpdate = false
    switch (event.keyCode) {
      case scope.keys.UP:
        pan(0, scope.keyPanSpeed)
        needsUpdate = true
        break

      case scope.keys.BOTTOM:
        pan(0, -scope.keyPanSpeed)
        needsUpdate = true
        break

      case scope.keys.LEFT:
      case scope.keys.LEFTARROW:
        pan(scope.keyPanSpeed, 0)
        needsUpdate = true
        break

      case scope.keys.RIGHT:
      case scope.keys.RIGHTARROW:
        pan(-scope.keyPanSpeed, 0)
        needsUpdate = true
        break

      case scope.keys.IN:
      case scope.keys.UPARROW:
        dollyIn(getZoomScale())
        needsUpdate = true
        break

      case scope.keys.OUT:
      case scope.keys.DOWNARROW:
        dollyOut(getZoomScale())
        needsUpdate = true
        break
    }

    if (needsUpdate) {
      // prevent the browser from scrolling on cursor keys
      event.preventDefault()
      scope.update()
    }
  }

  function handleTouchStartRotate (event) {
    if (event.touches.length === 1) {
      rotateStart.set(event.touches[0].pageX, event.touches[0].pageY)
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX)
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY)
      rotateStart.set(x, y)
    }
  }

  function handleTouchStartPan (event) {
    if (event.touches.length === 1) {
      panStart.set(event.touches[0].pageX, event.touches[0].pageY)
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX)
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY)
      panStart.set(x, y)
    }
  }

  function handleTouchStartDolly (event) {
    const dx = event.touches[0].pageX - event.touches[1].pageX
    const dy = event.touches[0].pageY - event.touches[1].pageY
    const distance = Math.sqrt(dx * dx + dy * dy)
    dollyStart.set(0, distance)
  }

  function handleTouchStartDollyPan (event) {
    if (scope.enableZoom) handleTouchStartDolly(event)
    if (scope.enablePan) handleTouchStartPan(event)
  }

  function handleTouchStartDollyRotate (event) {
    if (scope.enableZoom) handleTouchStartDolly(event)
    if (scope.enableRotate) handleTouchStartRotate(event)
  }

  function rotateTo (x, y) {
    rotateEnd.set(x, y)
    rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed)
    const element = scope.domElement
    rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight) // yes, height
    rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight)
    rotateStart.copy(rotateEnd)
  }

  function handleTouchMoveRotate (event) {
    if (event.touches.length === 1) {
      rotateTo(event.touches[0].pageX, event.touches[0].pageY)
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX)
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY)
      rotateTo(x, y)
    }
  }

  function handleTouchMovePan (event) {
    if (event.touches.length === 1) {
      panEnd.set(event.touches[0].pageX, event.touches[0].pageY)
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX)
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY)
      panEnd.set(x, y)
    }

    panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed)
    pan(panDelta.x, panDelta.y)
    panStart.copy(panEnd)
  }

  function handleTouchMoveDolly (event) {
    const dx = event.touches[0].pageX - event.touches[1].pageX
    const dy = event.touches[0].pageY - event.touches[1].pageY
    const distance = Math.sqrt(dx * dx + dy * dy)

    dollyEnd.set(0, distance)
    dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed))

    // only dolly if the movement exceeds an epsilon value.
    if (Math.abs(dollyDelta.y - 1) > 0.0001) {
      if (dollyDelta.y < 1) {
        dollyIn(dollyDelta.y)
      } else {
        dollyOut(dollyDelta.y)
      }
    }

    dollyStart.copy(dollyEnd)
  }

  function handleTouchMoveDollyPan (event) {
    if (scope.enableZoom) handleTouchMoveDolly(event)
    if (scope.enablePan) handleTouchMovePan(event)
  }

  function handleTouchMoveDollyRotate (event) {
    if (scope.enableZoom) handleTouchMoveDolly(event)
    if (scope.enableRotate) handleTouchMoveRotate(event)
  }

  function handleTouchEnd (/* event */) {
    // no-op
  }

  //
  // event handlers - FSM: listen for events and reset state
  //

  function onMouseDown (event) {
    if (scope.enabled === false) return

    // Prevent the browser from scrolling.
    event.preventDefault()

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.

    scope.domElement.focus ? scope.domElement.focus() : window.focus()

    let mouseAction

    switch (event.button) {
      case 0:
        mouseAction = scope.mouseButtons.LEFT
        break

      case 1:
        mouseAction = scope.mouseButtons.MIDDLE
        break

      case 2:
        mouseAction = scope.mouseButtons.RIGHT
        break

      default:
        mouseAction = -1
        break
    }

    switch (mouseAction) {
      case THREE.MOUSE.DOLLY:

        if (scope.enableZoom === false) return
        handleMouseDownDolly(event)
        state = STATE.DOLLY
        break

      case THREE.MOUSE.ROTATE:

        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (scope.enablePan === false) return
          handleMouseDownPan(event)
          state = STATE.PAN
        } else {
          if (scope.enableRotate === false) return
          handleMouseDownRotate(event)
          state = STATE.ROTATE
        }

        break

      case THREE.MOUSE.PAN:

        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          if (scope.enableRotate === false) { return }
          handleMouseDownRotate(event)
          state = STATE.ROTATE
        } else {
          if (scope.enablePan === false) { return }
          handleMouseDownPan(event)
          state = STATE.PAN
        }

        break

      default:
        state = STATE.NONE
        break
    }

    if (state !== STATE.NONE) {
      document.addEventListener('mousemove', onMouseMove, false)
      document.addEventListener('mouseup', onMouseUp, false)
      scope.dispatchEvent(startEvent)
    }
  }

  function onMouseMove (event) {
    if (scope.enabled === false) return

    event.preventDefault()

    switch (state) {
      case STATE.ROTATE:

        if (scope.enableRotate === false) return
        handleMouseMoveRotate(event)
        break

      case STATE.DOLLY:

        if (scope.enableZoom === false) return
        handleMouseMoveDolly(event)
        break

      case STATE.PAN:

        if (scope.enablePan === false) return
        handleMouseMovePan(event)
        break
    }
  }

  function onMouseUp (event) {
    if (scope.enabled === false) return
    handleMouseUp(event)
    document.removeEventListener('mousemove', onMouseMove, false)
    document.removeEventListener('mouseup', onMouseUp, false)
    scope.dispatchEvent(endEvent)
    state = STATE.NONE
  }

  function onMouseWheel (event) {
    if (scope.enabled === false || scope.enableZoom === false || (state !== STATE.NONE && state !== STATE.ROTATE)) return
    event.preventDefault()
    event.stopPropagation()
    scope.dispatchEvent(startEvent)
    handleMouseWheel(event)
    scope.dispatchEvent(endEvent)
  }

  function onKeyDown (event) {
    if (scope.enabled === false || scope.enableKeys === false || scope.enablePan === false) return
    handleKeyDown(event)
  }

  function onTouchStart (event) {
    if (scope.enabled === false) return

    event.preventDefault() // prevent scrolling

    switch (event.touches.length) {
      case 1:

        switch (scope.touches.ONE) {
          case THREE.TOUCH.ROTATE:
            if (scope.enableRotate === false) return
            handleTouchStartRotate(event)
            state = STATE.TOUCH_ROTATE
            break

          case THREE.TOUCH.PAN:
            if (scope.enablePan === false) return
            handleTouchStartPan(event)
            state = STATE.TOUCH_PAN
            break

          default:
            state = STATE.NONE
            break
        }

        break

      case 2:

        switch (scope.touches.TWO) {
          case THREE.TOUCH.DOLLY_PAN:
            if (scope.enableZoom === false && scope.enablePan === false) return
            handleTouchStartDollyPan(event)
            state = STATE.TOUCH_DOLLY_PAN
            break

          case THREE.TOUCH.DOLLY_ROTATE:
            if (scope.enableZoom === false && scope.enableRotate === false) return
            handleTouchStartDollyRotate(event)
            state = STATE.TOUCH_DOLLY_ROTATE
            break

          default:
            state = STATE.NONE
            break
        }
        break

      default:

        state = STATE.NONE
        break
    }

    if (state !== STATE.NONE) {
      scope.dispatchEvent(startEvent)
    }
  }

  function onTouchMove (event) {
    if (scope.enabled === false) return

    // Enable propagation
    // event.preventDefault(); // prevent scrolling
    // event.stopPropagation();

    switch (state) {
      case STATE.TOUCH_ROTATE:
        if (scope.enableRotate === false) return
        handleTouchMoveRotate(event)
        scope.update()
        break

      case STATE.TOUCH_PAN:
        if (scope.enablePan === false) return
        handleTouchMovePan(event)
        scope.update()
        break

      case STATE.TOUCH_DOLLY_PAN:
        if (scope.enableZoom === false && scope.enablePan === false) return
        handleTouchMoveDollyPan(event)
        scope.update()
        break

      case STATE.TOUCH_DOLLY_ROTATE:
        if (scope.enableZoom === false && scope.enableRotate === false) return
        handleTouchMoveDollyRotate(event)
        scope.update()
        break

      default:
        state = STATE.NONE
    }
  }

  function onTouchEnd (event) {
    if (scope.enabled === false) return
    handleTouchEnd(event)
    scope.dispatchEvent(endEvent)
    state = STATE.NONE
  }

  function onContextMenu (event) {
    if (scope.enabled === false) return
    event.preventDefault()
  }

  //

  scope.domElement.addEventListener('contextmenu', onContextMenu, false)
  scope.domElement.addEventListener('mousedown', onMouseDown, false)
  scope.domElement.addEventListener('wheel', onMouseWheel, false)
  scope.domElement.addEventListener('touchstart', onTouchStart, false)
  scope.domElement.addEventListener('touchend', onTouchEnd, false)
  scope.domElement.addEventListener('touchmove', onTouchMove, false)
  scope.domElement.addEventListener('keydown', onKeyDown, false)

  // make sure element can receive keys.

  if (scope.domElement.tabIndex === -1) {
    scope.domElement.tabIndex = 0
  }

  // force an update at start

  this.update()
}

OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype)
OrbitControls.prototype.constructor = OrbitControls

export function MapControls (object, domElement) {
  OrbitControls.call(this, object, domElement)

  this.mouseButtons.LEFT = THREE.MOUSE.PAN
  this.mouseButtons.RIGHT = THREE.MOUSE.ROTATE

  this.touches.ONE = THREE.TOUCH.PAN
  this.touches.TWO = THREE.TOUCH.DOLLY_ROTATE
}

MapControls.prototype = Object.create(THREE.EventDispatcher.prototype)
MapControls.prototype.constructor = MapControls