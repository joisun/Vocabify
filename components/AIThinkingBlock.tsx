import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { cn } from '@/lib/utils'

type BunCharacterTheme = 'auto' | 'light' | 'dark'
export type BunCharacterState = 'idle' | 'loading' | 'thinking' | 'building'
type AgentState = 'IDLE' | 'LOADING' | 'THINKING'

export function getStreamCharacterState({
  streaming,
  hasReceivedChunk,
  hasReceivedReasoning,
  hasSenses,
}: {
  streaming: boolean
  hasReceivedChunk: boolean
  hasReceivedReasoning: boolean
  hasSenses: boolean
}): BunCharacterState {
  if (!streaming || hasSenses) return 'idle'
  if (hasReceivedChunk) return 'building'
  return hasReceivedReasoning ? 'thinking' : 'loading'
}

export function AIThinkingBlock({
  active = true,
  label = 'Thinking',
  compact = false,
  showCharacter = true,
  state = 'thinking',
  className,
}: {
  active?: boolean
  label?: string
  compact?: boolean
  showCharacter?: boolean
  state?: BunCharacterState
  className?: string
}) {
  if (!active) return null

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-[7px] bg-secondary/35 text-[11px] leading-5 text-muted-foreground dark:bg-white/[0.035]',
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5',
        className,
      )}
      data-testid="vocabify-stream-thinking"
      aria-live="polite"
    >
      {showCharacter && <BunCharacter compact={compact} state={state} />}
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      </span>
    </div>
  )
}

// --- 基础数学：完美无瑕的 2D 胶囊轮廓 ---
function getCapsulePoint(t: number, w: number, h: number) {
  const r = h / 2
  const straightL = w - 2 * r

  const segmentT = (t % (Math.PI / 2)) / (Math.PI / 2)
  const quad = Math.floor(t / (Math.PI / 2)) % 4

  const arcLen = (Math.PI * r) / 2
  const halfStraight = straightL / 2
  const quadLen = arcLen + halfStraight

  let s = segmentT * quadLen
  let x = 0
  let y = 0

  if (quad === 0) {
    if (s < arcLen) {
      const arcAngle = s / r
      x = halfStraight + r * Math.cos(arcAngle)
      y = r * Math.sin(arcAngle)
    } else {
      x = halfStraight - (s - arcLen)
      y = r
    }
  } else if (quad === 1) {
    if (s < halfStraight) {
      x = -s
      y = r
    } else {
      const arcAngle = Math.PI / 2 + (s - halfStraight) / r
      x = -halfStraight + r * Math.cos(arcAngle)
      y = r * Math.sin(arcAngle)
    }
  } else if (quad === 2) {
    if (s < arcLen) {
      const arcAngle = Math.PI + s / r
      x = -halfStraight + r * Math.cos(arcAngle)
      y = r * Math.sin(arcAngle)
    } else {
      x = -halfStraight + (s - arcLen)
      y = -r
    }
  } else {
    if (s < halfStraight) {
      x = s
      y = -r
    } else {
      const arcAngle = 3 * Math.PI / 2 + (s - halfStraight) / r
      x = halfStraight + r * Math.cos(arcAngle)
      y = r * Math.sin(arcAngle)
    }
  }
  return new THREE.Vector3(x, y, 0)
}

// ==========================================
// 💡 终极多模态曲线重构
// ==========================================
class MorphCurve extends THREE.Curve<THREE.Vector3> {
  wI: number
  wL: number
  wT: number
  time: number

  constructor(wI: number, wL: number, wT: number, time: number) {
    super()
    this.wI = wI
    this.wL = wL
    this.wT = wT
    this.time = time
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()) {
    const angle = t * Math.PI * 2

    // 1. IDLE
    const pIdle = getCapsulePoint(angle, 4, 2.4)

    // 2. LOADING
    const twistX = Math.max(-2, Math.min(2, pIdle.x))
    const phase = (twistX / 2.0) * (Math.PI * 1.5) + (Math.PI / 2)
    const pLoad = new THREE.Vector3(
      pIdle.x,
      pIdle.y * Math.cos(phase),
      pIdle.y * Math.sin(phase),
    )

    // 3. THINKING
    const pThinkBase = getCapsulePoint(angle, 4, 0.38)
    const waveFreq = 4.2
    const waveSpeed = 8.0
    const waveAmp = 0.85

    const pThink = new THREE.Vector3(
      pThinkBase.x,
      Math.sin(pThinkBase.x * waveFreq - this.time * waveSpeed) * waveAmp,
      pThinkBase.y,
    )

    // 4. MIKING
    const x = pIdle.x * this.wI + pLoad.x * this.wL + pThink.x * this.wT
    const y = pIdle.y * this.wI + pLoad.y * this.wL + pThink.y * this.wT
    const z = pIdle.z * this.wI + pLoad.z * this.wL + pThink.z * this.wT

    return optionalTarget.set(x, y, z)
  }
}

// ==========================================
// 💡 可完全复用的核心 3D 智能体组件
// 支持 transparent 背景, 100% width 自适应, 和外部的主题色注入
// ==========================================
export function AgentFace({
  color = '#EF4444',
  agentState = 'IDLE',
  className = 'w-full h-full min-h-[300px]',
}: {
  color?: string
  agentState?: AgentState
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const stateRef = useRef({
    agentState: 'IDLE' as AgentState,
    targetColor: new THREE.Color(color), // 目标主题色
    wasLoading: false,
    weights: [1, 0, 0],
    lastWeights: [-1, -1, -1],
    continuousRotX: 0,
    targetSnapX: 0,
    mouseX: 0,
    mouseY: 0,
    smoothMouseX: 0,
    smoothMouseY: 0,
    blink: 0,
    eyeR: 0.34,
    eyeL: 0,
  })

  // 同步外部的 Prop 状态到渲染器
  useEffect(() => {
    stateRef.current.agentState = agentState
  }, [agentState])

  useEffect(() => {
    // 同步颜色，这里只更新目标颜色，具体的平滑渐变交给了 animate 渲染循环
    stateRef.current.targetColor.set(color)
  }, [color])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 设置为透明背景 (alpha: true)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000)

    // --- 核心视口适配算法 ---
    const updateCameraDistance = () => {
      const aspect = container.clientWidth / container.clientHeight
      // 保证在任何比例下（宽屏或窄竖屏），模型都能刚好 100% 填满容器宽度
      camera.aspect = aspect
      camera.position.z = 4.8 / Math.min(1, aspect)
      camera.updateProjectionMatrix()
    }
    updateCameraDistance()

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffffff, 3.5)
    mainLight.position.set(5, 10, 7)
    scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5)
    fillLight.position.set(-5, -2, -5)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 3.0)
    rimLight.position.set(0, 5, -10)
    scene.add(rimLight)

    const faceGroup = new THREE.Group()
    scene.add(faceGroup)

    const materialProps = {
      color: stateRef.current.targetColor,
    }
    const tubeMat = new THREE.MeshBasicMaterial(materialProps)
    const eyeMat = new THREE.MeshBasicMaterial(materialProps)

    let curve = new MorphCurve(1, 0, 0, 0)
    let tubeGeo = new THREE.TubeGeometry(curve, 200, 0.18, 24, true)
    let tubeMesh = new THREE.Mesh(tubeGeo, tubeMat)
    faceGroup.add(tubeMesh)

    const sphereGeo = new THREE.SphereGeometry(1, 32, 16)
    const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 32)

    const createEye = (posX: number) => {
      const group = new THREE.Group()
      group.position.x = posX

      const lSphere = new THREE.Mesh(sphereGeo, eyeMat)
      const rSphere = new THREE.Mesh(sphereGeo, eyeMat)
      const cylinder = new THREE.Mesh(cylinderGeo, eyeMat)

      cylinder.rotation.z = Math.PI / 2

      group.add(lSphere)
      group.add(rSphere)
      group.add(cylinder)
      scene.add(group)

      return { group, lSphere, rSphere, cylinder, posX }
    }

    const eyeL = createEye(-0.8)
    const eyeR = createEye(0.8)

    const handleResize = () => {
      updateCameraDistance()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = THREE.MathUtils.clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1)
      const y = THREE.MathUtils.clamp(-((e.clientY - rect.top) / rect.height) * 2 + 1, -1, 1)
      stateRef.current.mouseX = x
      stateRef.current.mouseY = y
    }
    // 监听全局鼠标，使得即使在容器外部移动鼠标，眼睛也能看向对应方向
    window.addEventListener('mousemove', handleMouseMove)

    const blinkInterval = setInterval(() => {
      stateRef.current.blink = 1
      setTimeout(() => {
        stateRef.current.blink = 0
      }, 150)
    }, 3000 + Math.random() * 2000)

    const clock = new THREE.Clock()
    let animationFrameId = 0

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      const delta = Math.min(clock.getDelta(), 0.1)
      const time = clock.getElapsedTime()
      const state = stateRef.current

      // --- 主题颜色平滑过渡 (Lerp Color) ---
      tubeMat.color.lerp(state.targetColor, 0.05)
      eyeMat.color.lerp(state.targetColor, 0.05)

      // 权重控制
      const targetWeights = [
        state.agentState === 'IDLE' ? 1 : 0,
        state.agentState === 'LOADING' ? 1 : 0,
        state.agentState === 'THINKING' ? 1 : 0,
      ]

      state.weights[0] = THREE.MathUtils.lerp(state.weights[0], targetWeights[0], 0.08)
      state.weights[1] = THREE.MathUtils.lerp(state.weights[1], targetWeights[1], 0.08)
      state.weights[2] = THREE.MathUtils.lerp(state.weights[2], targetWeights[2], 0.08)

      const sum = state.weights[0] + state.weights[1] + state.weights[2]
      const wI = state.weights[0] / sum
      const wL = state.weights[1] / sum
      const wT = state.weights[2] / sum

      const isWeightChanged =
        Math.abs(wI - state.lastWeights[0]) > 0.001 ||
        Math.abs(wL - state.lastWeights[1]) > 0.001 ||
        Math.abs(wT - state.lastWeights[2]) > 0.001

      if (isWeightChanged || wT > 0.01) {
        tubeMesh.geometry.dispose()
        curve.wI = wI
        curve.wL = wL
        curve.wT = wT
        curve.time = time
        tubeMesh.geometry = new THREE.TubeGeometry(curve, 200, 0.18, 24, true)

        state.lastWeights = [wI, wL, wT]
      }

      if (state.agentState === 'LOADING') {
        if (!state.wasLoading) state.wasLoading = true
        state.continuousRotX += delta * 2.0
      } else {
        if (state.wasLoading) {
          state.targetSnapX = Math.round(state.continuousRotX / (Math.PI * 2)) * (Math.PI * 2)
          state.wasLoading = false
        }
        state.continuousRotX = THREE.MathUtils.lerp(state.continuousRotX, state.targetSnapX, 0.08)
      }

      state.smoothMouseX = THREE.MathUtils.lerp(state.smoothMouseX, state.mouseX, 0.1)
      state.smoothMouseY = THREE.MathUtils.lerp(state.smoothMouseY, state.mouseY, 0.1)

      const interactionWeight = wI

      faceGroup.rotation.x = state.continuousRotX + state.smoothMouseY * 0.045 * interactionWeight
      faceGroup.rotation.y = state.smoothMouseX * 0.045 * interactionWeight

      const floatY = Math.sin(time * 2) * 0.1 * interactionWeight
      faceGroup.position.y = THREE.MathUtils.lerp(faceGroup.position.y, floatY, 0.2)

      const targetR = state.blink ? 0.05 : 0.34
      const targetL = state.blink ? 0.20 : 0
      state.eyeR = THREE.MathUtils.lerp(state.eyeR, targetR, 0.3)
      state.eyeL = THREE.MathUtils.lerp(state.eyeL, targetL, 0.3)

      const scaleMult = Math.max(0, Math.pow(wI, 1.5))

      const updateEyeMesh = (eye: ReturnType<typeof createEye>) => {
        const r = Math.max(0.001, state.eyeR * scaleMult)
        const l = state.eyeL * scaleMult

        eye.lSphere.position.set(-l, 0, 0)
        eye.lSphere.scale.set(r, r, r)

        eye.rSphere.position.set(l, 0, 0)
        eye.rSphere.scale.set(r, r, r)

        eye.cylinder.position.set(0, 0, 0)
        eye.cylinder.scale.set(r, Math.max(0.001, l * 2), r)

        eye.group.position.x = THREE.MathUtils.lerp(eye.group.position.x, eye.posX + state.mouseX * 0.18, 0.1)
        eye.group.position.y = THREE.MathUtils.lerp(eye.group.position.y, floatY + state.mouseY * 0.18, 0.1)
      }

      updateEyeMesh(eyeL)
      updateEyeMesh(eyeR)

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      clearInterval(blinkInterval)
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      tubeGeo.dispose()
      tubeMat.dispose()
      sphereGeo.dispose()
      cylinderGeo.dispose()
      eyeMat.dispose()
      renderer.dispose()
    }
  }, [])

  return <div ref={containerRef} className={className} />
}

export function BunCharacter({
  compact,
  size,
  theme = 'auto',
  state = 'idle',
}: {
  compact?: boolean
  size?: number
  theme?: BunCharacterTheme
  state?: BunCharacterState
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const isDark = useCharacterDarkMode(ref, theme)
  const resolvedSize = size ?? (compact ? 18 : 22)
  const agentState = toAgentState(state)
  const color = isDark ? '#ffffff' : '#000000'

  return (
    <div
      ref={ref}
      className="relative shrink-0"
      style={{ width: resolvedSize, height: resolvedSize }}
      aria-hidden
    >
      <AgentFace color={color} agentState={agentState} className="h-full w-full" />
    </div>
  )
}

function toAgentState(state: BunCharacterState): AgentState {
  if (state === 'loading') return 'LOADING'
  if (state === 'thinking' || state === 'building') return 'THINKING'
  return 'IDLE'
}

function useCharacterDarkMode(ref: React.RefObject<HTMLElement>, theme: BunCharacterTheme) {
  const [isDark, setIsDark] = useState(theme === 'dark')

  useEffect(() => {
    if (theme !== 'auto') {
      setIsDark(theme === 'dark')
      return
    }

    const update = () => {
      const themeBoundary = ref.current?.closest('.light, .dark')
      setIsDark(themeBoundary ? themeBoundary.classList.contains('dark') : document.documentElement.classList.contains('dark'))
    }

    update()

    const observer = new MutationObserver(update)
    const targets = new Set<Element>([document.documentElement])
    let node = ref.current

    while (node) {
      targets.add(node)
      node = node.parentElement
    }

    for (const target of targets) {
      observer.observe(target, { attributes: true, attributeFilter: ['class'] })
    }

    return () => observer.disconnect()
  }, [ref, theme])

  return isDark
}
