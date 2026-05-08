export async function solveSlideCaptcha(): Promise<boolean> {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) return true

  const bgImg = document.querySelector('.captcha-bg img') as HTMLImageElement | null
  const sliderImg = document.querySelector('.captcha-slider img') as HTMLImageElement | null
  if (!bgImg || !sliderImg) return true

  const offset = await findSlideOffset(bgImg, sliderImg)
  if (offset <= 0) return false

  await simulateDrag(canvas, offset)
  return true
}

async function findSlideOffset(_bg: HTMLImageElement, _slider: HTMLImageElement): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, img.width, img.height).data
      let leftEdge = -1
      for (let x = 0; x < img.width && leftEdge < 0; x++) {
        for (let y = 0; y < img.height; y++) {
          const i = (y * img.width + x) * 4
          if (data[i + 3] > 200 && data[i] < 200) { leftEdge = x; break }
        }
      }
      resolve(leftEdge > 0 ? leftEdge - 5 : Math.floor(img.width * 0.4))
    }
    img.src = _bg.src
  })
}

async function simulateDrag(canvas: HTMLCanvasElement, offset: number): Promise<void> {
  const rect = canvas.getBoundingClientRect()
  const startX = rect.left + 20
  const startY = rect.top + rect.height / 2
  const track = generateTrack(offset)

  const slider = canvas.closest('.captcha-slider') || canvas
  slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, clientY: startY, bubbles: true }))

  for (const step of track) {
    await sleep(10 + Math.random() * 10)
    const cx = startX + step
    const cy = startY + (Math.random() - 0.5) * 6
    slider.dispatchEvent(new PointerEvent('pointermove', { clientX: cx, clientY: cy, bubbles: true }))
  }

  await sleep(50)
  slider.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + offset, clientY: startY, bubbles: true }))
}

function generateTrack(distance: number): number[] {
  const track: number[] = []
  let current = 0
  while (current < distance) {
    const remaining = distance - current
    const step = Math.min(remaining, 2 + Math.random() * 3)
    current += step
    track.push(current)
  }
  return track
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
