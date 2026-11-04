import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import unzipper from 'unzipper'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const root = process.cwd()
const artifacts = join(root, 'test-artifacts')
const dataDir = await mkdtemp(join(tmpdir(), 'taskmind-e2e-'))
const imagePath = process.env.TEST_IMAGE_PATH
  ? resolve(process.env.TEST_IMAGE_PATH)
  : join(artifacts, 'ai-input.png')
const secondImagePath = process.env.TEST_IMAGE_PATH_2
  ? resolve(process.env.TEST_IMAGE_PATH_2)
  : join(artifacts, 'ai-input-2.png')
const envAiKey = process.env.TASKMIND_AI_KEY?.trim() ?? ''
const inputAiKey = process.env.E2E_ENTER_KEY?.trim() ?? ''
const hasAiKey = Boolean(envAiKey || inputAiKey)

await mkdir(artifacts, { recursive: true })

let electronApp
const pageErrors = []

function log(message) {
  console.log(`[e2e] ${message}`)
}

function setClipboardImage(filePath) {
  assert.ok(existsSync(filePath), `test image missing: ${filePath}`)
  const safePath = filePath.replace(/'/g, "''")
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-STA',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $img=[System.Drawing.Image]::FromFile('${safePath}'); [System.Windows.Forms.Clipboard]::SetImage($img); $img.Dispose()`
    ],
    { windowsHide: true }
  )
}

async function main() {
  const packagedExecutable = process.env.E2E_EXECUTABLE?.trim()
  log(packagedExecutable ? `launching packaged app: ${packagedExecutable}` : 'launching dev build')
  electronApp = await electron.launch({
    executablePath: packagedExecutable || electronPath,
    args: packagedExecutable ? [] : [root],
    cwd: packagedExecutable ? resolve(packagedExecutable, '..') : root,
    env: {
      ...process.env,
      TASKMIND_DATA_DIR: dataDir,
      TASKMIND_AI_KEY: envAiKey
    },
    timeout: 40_000
  })

  await new Promise((resolveWait) => setTimeout(resolveWait, 1200))
  const windows = electronApp.windows()
  const mainPage = windows.find((page) => !page.url().includes('#/ball'))
  assert(mainPage, 'main window did not open')
  mainPage.setDefaultTimeout(15_000)
  mainPage.on('pageerror', (error) => pageErrors.push(String(error)))

  log(`main window: ${mainPage.url()}`)
  await mainPage.waitForLoadState('domcontentloaded')

  const onboarding = mainPage.getByRole('dialog').filter({ hasText: '欢迎使用 TaskMind' })
  await onboarding.waitFor({ timeout: 20_000 })
  await mainPage.screenshot({ path: join(artifacts, '01-onboarding.png') })
  if (inputAiKey) {
    const keyInput = onboarding.locator('input[type="password"]')
    if ((await keyInput.count()) > 0) {
      await keyInput.fill(inputAiKey)
    }
  }
  await onboarding.getByRole('button', { name: '保存并开始' }).click()
  await onboarding.waitFor({ state: 'hidden', timeout: 15_000 })
  await mainPage.getByText('今日待办', { exact: true }).first().waitFor()
  await mainPage.screenshot({ path: join(artifacts, '02-main-empty.png') })

  log('adding a manual task')
  await mainPage.getByRole('button', { name: '添加任务' }).first().click()
  const addDialog = mainPage.getByRole('dialog').filter({ hasText: '添加任务' })
  await addDialog.waitFor()
  await addDialog.locator('#task-title').fill('E2E 手动任务')
  await addDialog.locator('#task-client').fill('测试客户')
  await addDialog.locator('#task-content').fill('这是手动添加的测试任务，明天上门。')
  await addDialog.locator('#task-notes').fill('带好工具，提前打电话。')
  await addDialog.getByRole('button', { name: '明天' }).click()
  await addDialog.getByRole('button', { name: '添加任务' }).click()
  await mainPage.getByText('任务已添加').waitFor({ timeout: 15_000 })
  await addDialog.waitFor({ state: 'hidden' })
  await mainPage.screenshot({ path: join(artifacts, '03-task-added.png') })

  log('testing status transitions')
  const card = mainPage
    .locator('div[role="button"]')
    .filter({ hasText: 'E2E 手动任务' })
    .first()
  await card.getByRole('button', { name: '开始' }).click()
  await mainPage.getByText('开始成功').waitFor({ timeout: 15_000 })
  await mainPage.screenshot({ path: join(artifacts, '04-in-progress.png') })

  await mainPage.getByRole('button', { name: /已完成/ }).first().click()
  // 等待视图切换，此时任务不在这里
  await mainPage.waitForTimeout(400)
  await mainPage.getByRole('button', { name: /未完成/ }).first().click()
  await mainPage.waitForTimeout(500)
  const inProgressCard = mainPage
    .locator('div[role="button"]')
    .filter({ hasText: 'E2E 手动任务' })
    .first()
  await inProgressCard.getByRole('button', { name: '完成' }).click()
  await mainPage.getByText('完成成功').waitFor({ timeout: 15_000 })

  await mainPage.getByRole('button', { name: /已完成/ }).first().click()
  await mainPage.waitForTimeout(500)
  const completedCard = mainPage
    .locator('div[role="button"]')
    .filter({ hasText: 'E2E 手动任务' })
    .first()
  await completedCard.getByRole('button', { name: '还原' }).click()
  await mainPage.getByText('还原成功').waitFor({ timeout: 15_000 })
  await mainPage.screenshot({ path: join(artifacts, '05-restored.png') })

  if (hasAiKey) {
    log('testing real clipboard paste + multi-image AI extraction')
    setClipboardImage(imagePath)
    await new Promise((resolveWait) => setTimeout(resolveWait, 350))

    await mainPage.getByRole('button', { name: '添加任务' }).first().click()
    const aiDialog = mainPage.getByRole('dialog').filter({ hasText: '添加任务' })
    await aiDialog.waitFor()
    await aiDialog.locator('#task-title').click()
    await mainPage.keyboard.press('Control+V')
    await mainPage.waitForFunction(
      () => {
        const input = document.querySelector('#task-title')
        return input instanceof HTMLInputElement && input.value.trim().length > 0
      },
      undefined,
      { timeout: 90_000 }
    )

    log('adding a second screenshot to the same task')
    setClipboardImage(secondImagePath)
    await new Promise((resolveWait) => setTimeout(resolveWait, 350))
    await mainPage.keyboard.press('Control+V')
    await mainPage.waitForFunction(
      () => {
        const content = document.querySelector('#task-content')
        const notes = document.querySelector('#task-notes')
        const contentValue =
          content instanceof HTMLTextAreaElement ? content.value : ''
        const notesValue = notes instanceof HTMLTextAreaElement ? notes.value : ''
        return contentValue.includes('2468') || notesValue.includes('2468')
      },
      undefined,
      { timeout: 120_000 }
    )
    const aiTitle = await aiDialog.locator('#task-title').inputValue()
    log(`AI combined title: ${aiTitle}`)
    assert.ok(aiTitle.length > 2, 'AI did not fill a title')
    await mainPage.waitForTimeout(300)
    await mainPage.screenshot({ path: join(artifacts, '06-ai-filled.png') })
    await aiDialog.getByRole('button', { name: '添加任务' }).click()
    await mainPage.getByText('任务已添加').waitFor({ timeout: 15_000 })
    await aiDialog.waitFor({ state: 'hidden' })
    await mainPage.waitForTimeout(350)
    await mainPage.screenshot({ path: join(artifacts, '06b-ai-task-added.png') })

    const closeToast = mainPage.getByRole('button', { name: '关闭提示' }).last()
    if ((await closeToast.count()) > 0) {
      await closeToast.click()
      await mainPage.waitForTimeout(200)
    }

    log('opening AI task detail and screenshot lightbox')
    const aiCard = mainPage
      .locator('div[role="button"]')
      .filter({ hasText: aiTitle })
      .first()
    await aiCard.click()
    const aiDetail = mainPage.getByRole('dialog').filter({ hasText: aiTitle })
    await aiDetail.waitFor({ timeout: 10_000 })
    await mainPage.waitForTimeout(300)
    await mainPage.screenshot({ path: join(artifacts, '06c-ai-detail.png') })
    const thumbImage = aiDetail.locator('button[title="查看大图"] img').first()
    await thumbImage.waitFor({ timeout: 10_000 })
    await mainPage.waitForTimeout(500)
    const naturalWidth = await thumbImage.evaluate((image) =>
      image instanceof HTMLImageElement ? image.naturalWidth : 0
    )
    log(`screenshot thumbnail naturalWidth: ${naturalWidth}`)
    assert.ok(naturalWidth > 0, 'screenshot image did not load through taskmind-media')
    const thumbButton = aiDetail.locator('button[title="查看大图"]').first()
    await thumbButton.scrollIntoViewIfNeeded()
    await thumbButton.click({ force: true })
    const lightbox = mainPage.getByRole('dialog', { name: '截图预览' })
    await lightbox.waitFor({ state: 'visible', timeout: 10_000 })
    await mainPage.waitForTimeout(250)
    await mainPage.screenshot({ path: join(artifacts, '06d-lightbox.png') })
    await lightbox.locator('button[title="关闭"]').click()
    await lightbox.waitFor({ state: 'hidden' })
    await mainPage.waitForTimeout(200)
    await aiDetail.getByRole('button', { name: '关闭' }).click()
    await mainPage.waitForTimeout(250)
  } else {
    log('no AI key provided, skipping AI paste test')
  }

  log('testing floating ball')
  await new Promise((resolveWait) => setTimeout(resolveWait, 800))
  const ballPage = electronApp.windows().find((page) => page.url().includes('#/ball'))
  assert(ballPage, 'ball window did not open')
  ballPage.setDefaultTimeout(10_000)
  await ballPage.locator('button').first().hover()
  await ballPage.getByText('最紧急', { exact: false }).waitFor({ timeout: 10_000 })
  await ballPage.waitForTimeout(300)
  await ballPage.screenshot({ path: join(artifacts, '07-ball-expanded.png') })

  log('testing ball drag')
  const ballButton = ballPage.locator('button[title^="最紧急"]')
  await ballButton.click()
  await ballPage.getByText('最紧急', { exact: false }).first().waitFor({ state: 'hidden' })
  await ballPage.waitForTimeout(300)
  const beforeBall = await ballPage.evaluate(() => ({ x: window.screenX, y: window.screenY }))
  await ballPage.evaluate(() => window.taskmind.ball.dragStart())
  const cursorOutput = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-STA',
      '-Command',
      'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $p=[System.Windows.Forms.Cursor]::Position; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(($p.X-60),($p.Y-30)); Write-Output "$($p.X),$($p.Y)"'
    ],
    { windowsHide: true, encoding: 'utf8' }
  ).trim()
  await ballPage.waitForTimeout(350)
  const dragResult = await ballPage.evaluate(() => window.taskmind.ball.dragEnd())
  assert.equal(dragResult.moved, true, 'dragEnd did not report movement')
  const afterBall = await ballPage.evaluate(() => ({ x: window.screenX, y: window.screenY }))
  log(`ball position ${JSON.stringify(beforeBall)} -> ${JSON.stringify(afterBall)}`)
  assert.ok(
    beforeBall.x !== afterBall.x || beforeBall.y !== afterBall.y,
    'ball did not move after drag'
  )
  const [cursorX, cursorY] = cursorOutput.split(',').map(Number)
  if (Number.isFinite(cursorX) && Number.isFinite(cursorY)) {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-STA',
        '-Command',
        `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${cursorX},${cursorY})`
      ],
      { windowsHide: true }
    )
  }

  log('testing real mouse drag while the urgent panel is open')
  await ballButton.hover()
  await ballPage.getByText('最紧急', { exact: false }).waitFor({ timeout: 10_000 })
  await ballPage.waitForTimeout(300)
  const ballBox = await ballButton.boundingBox()
  assert(ballBox, 'ball button has no bounding box')
  const expandedWindowPos = await ballPage.evaluate(() => ({
    x: window.screenX,
    y: window.screenY
  }))
  const centerX = Math.round(expandedWindowPos.x + ballBox.x + ballBox.width / 2)
  const centerY = Math.round(expandedWindowPos.y + ballBox.y + ballBox.height / 2)
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-STA',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class MouseSim { [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e); }'; $orig=[System.Windows.Forms.Cursor]::Position; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${centerX},${centerY}); Start-Sleep -Milliseconds 120; [MouseSim]::mouse_event(0x0002,0,0,0,[IntPtr]::Zero); for ($i=1; $i -le 8; $i++) { [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point((${centerX} - 6*$i),(${centerY} - 3*$i)); Start-Sleep -Milliseconds 20 }; [MouseSim]::mouse_event(0x0004,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 150; [System.Windows.Forms.Cursor]::Position = $orig`
    ],
    { windowsHide: true }
  )
  await ballPage.waitForTimeout(450)
  await ballPage.getByText('最紧急', { exact: false }).first().waitFor({ state: 'hidden' })
  const collapsedLayout = await ballPage.evaluate(() => window.taskmind.ball.getLayout())
  const collapsedWindowPos = await ballPage.evaluate(() => ({
    x: window.screenX,
    y: window.screenY
  }))
  const collapsedCenterX = collapsedWindowPos.x + collapsedLayout.ballSize / 2
  const collapsedCenterY = collapsedWindowPos.y + collapsedLayout.ballSize / 2
  log(
    `real mouse drag center ${centerX},${centerY} -> ${Math.round(collapsedCenterX)},${Math.round(collapsedCenterY)}`
  )
  assert.equal(collapsedLayout.expanded, false, 'panel did not collapse when dragging')
  assert.ok(
    Math.abs(centerX - collapsedCenterX) > 5 || Math.abs(centerY - collapsedCenterY) > 5,
    'real mouse drag did not move the ball'
  )

  await ballButton.hover()
  await ballPage.getByText('最紧急', { exact: false }).waitFor({ timeout: 10_000 })
  await ballPage.waitForTimeout(250)
  const ballTaskButton = ballPage
    .getByRole('button')
    .filter({ hasText: 'E2E 手动任务' })
    .first()
  await ballTaskButton.click()
  await mainPage.getByRole('dialog').filter({ hasText: 'E2E 手动任务' }).waitFor({
    timeout: 10_000
  })
  await mainPage.screenshot({ path: join(artifacts, '08-ball-navigated.png') })
  await mainPage.getByRole('dialog').getByRole('button', { name: '关闭' }).click()

  log('testing settings dialog')
  await mainPage.getByRole('button', { name: '设置' }).first().click()
  const settingsDialog = mainPage.getByRole('dialog').filter({ hasText: 'AI 识别' })
  await settingsDialog.waitFor({ timeout: 10_000 })
  await mainPage.waitForTimeout(350)
  await mainPage.screenshot({ path: join(artifacts, '09-settings.png') })

  const notifyResult = await mainPage.evaluate(() => window.taskmind.notifications.test())
  log(`notification test: ${JSON.stringify(notifyResult)}`)
  assert.equal(notifyResult.ok, true, 'notification test failed')

  log('testing ball size and edge docking')
  await ballPage.evaluate(() => window.taskmind.ball.setExpanded(false))
  await ballPage.waitForTimeout(250)
  const sizeSlider = settingsDialog.locator('input[aria-label="浮球大小"]')
  await sizeSlider.focus()
  await sizeSlider.press('End')
  let currentBallSize = 0
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = await mainPage.evaluate(() => window.taskmind.settings.get())
    currentBallSize = current.ball.size
    if (currentBallSize === 120) break
    await new Promise((resolveWait) => setTimeout(resolveWait, 100))
  }
  assert.equal(currentBallSize, 120, 'ball size setting did not update')
  await ballPage.waitForTimeout(500)
  const resizedBall = await ballPage.evaluate(() => ({
    x: window.screenX,
    y: window.screenY,
    size: window.outerWidth,
    screenWidth: screen.availWidth
  }))
  log(`ball size after slider: ${JSON.stringify(resizedBall)}`)
  assert.ok(resizedBall.size >= 110, 'ball window did not resize')

  const startCenterX = Math.round(resizedBall.x + resizedBall.size / 2)
  const startCenterY = Math.round(resizedBall.y + resizedBall.size / 2)
  const dockTargetX = Math.round(resizedBall.screenWidth - 2)
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-STA',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class MouseSim2 { [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e); }'; $orig=[System.Windows.Forms.Cursor]::Position; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${startCenterX},${startCenterY}); Start-Sleep -Milliseconds 120; [MouseSim2]::mouse_event(0x0002,0,0,0,[IntPtr]::Zero); for ($i=1; $i -le 10; $i++) { $nx = [int]((${startCenterX} + (${dockTargetX} - ${startCenterX}) * $i / 10)); [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($nx,${startCenterY}); Start-Sleep -Milliseconds 25 }; [MouseSim2]::mouse_event(0x0004,0,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 150; [System.Windows.Forms.Cursor]::Position = $orig`
    ],
    { windowsHide: true }
  )
  await ballPage.waitForTimeout(600)
  const dockedState = await ballPage.evaluate(() => ({
    x: window.screenX,
    y: window.screenY,
    size: window.outerWidth
  }))
  const dockedSettings = await mainPage.evaluate(() => window.taskmind.settings.get())
  log(
    `docked state: ${JSON.stringify(dockedState)} dock=${dockedSettings.ball.dock}`
  )
  assert.equal(dockedSettings.ball.dock, 'right', 'ball did not dock to the right edge')
  assert.ok(dockedState.size < 120, 'docked ball did not shrink')
  await ballPage.screenshot({ path: join(artifacts, '11-ball-docked.png') })

  if (process.env.E2E_TEST_BACKUP === '1') {
    log('testing backup export')
    const backupPath = join(artifacts, 'backup-e2e.zip')
    await rm(backupPath, { force: true })
    await settingsDialog.getByRole('button', { name: '导出备份' }).click()
    await mainPage.waitForTimeout(1000)
    const sendKeysPath = backupPath.replace(/\\/g, '/')
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-STA',
        '-Command',
        `Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 300; [System.Windows.Forms.SendKeys]::SendWait('%n'); Start-Sleep -Milliseconds 150; [System.Windows.Forms.SendKeys]::SendWait('^a'); [System.Windows.Forms.SendKeys]::SendWait('${sendKeysPath}'); [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')`
      ],
      { windowsHide: true }
    )
    await mainPage.getByText('备份已导出').waitFor({ timeout: 20_000 })
    assert.ok(existsSync(backupPath), 'backup zip was not created')
    const archive = await unzipper.Open.file(backupPath)
    const entryNames = archive.files.map((entry) => entry.path)
    assert.ok(entryNames.includes('taskmind.db'), 'backup missing taskmind.db')
    assert.ok(entryNames.includes('settings.json'), 'backup missing settings.json')
    assert.ok(
      entryNames.some((name) => name.startsWith('images/')),
      'backup missing images'
    )
    log(`backup entries: ${entryNames.slice(0, 6).join(', ')}`)
    await rm(backupPath, { force: true })
  }

  await settingsDialog.getByRole('button', { name: '深色' }).click()
  await mainPage.waitForTimeout(350)
  await settingsDialog.getByRole('button', { name: '完成' }).click()
  await mainPage.waitForTimeout(350)
  await mainPage.screenshot({ path: join(artifacts, '10-main-dark.png') })

  assert.deepEqual(pageErrors, [], `renderer errors: ${pageErrors.join('\n')}`)
  log('E2E smoke test passed')
}

try {
  await main()
} finally {
  if (electronApp) {
    await electronApp.close().catch(() => {})
  }
  await rm(dataDir, { recursive: true, force: true }).catch(() => {})
}
