import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db/database'
import { ProjectService } from '../src/main/services/projectService'
import { TaskService, type TaskMedia } from '../src/main/services/taskService'
import { extractBackupZip, writeBackupZip } from '../src/main/services/backupArchive'
import type { SavedImage } from '../src/main/services/mediaService'

class StubMedia implements TaskMedia {
  async saveImage(_dataUrl: string): Promise<SavedImage> {
    const id = randomUUID()
    return {
      id,
      fileName: `${id}.png`,
      thumbName: null,
      mimeType: 'image/png',
      width: 800,
      height: 600
    }
  }

  async deleteFiles(_fileName: string, _thumbName: string | null): Promise<void> {
    // no-op
  }
}

describe('project backup round-trip', () => {
  it('keeps projects and task associations after export and import', async () => {
    const root = await mkdtemp(join(tmpdir(), 'taskmind-project-backup-'))
    try {
      const sourcePath = join(root, 'source.db')
      const source = openDatabase(sourcePath)
      const projects = new ProjectService(source)
      const tasks = new TaskService(source, new StubMedia())
      const project = projects.create({ name: '备份项目', color: '#2563eb' })
      const task = await tasks.create({
        title: '备份任务',
        projectId: project.id,
        client: '李姐'
      })
      const backupPath = join(root, 'taskmind.db')
      await source.backup(backupPath)
      source.close()

      const imagesDir = join(root, 'images')
      await mkdir(imagesDir, { recursive: true })
      await writeFile(join(imagesDir, 'shot.png'), 'fake-image')
      const zipPath = join(root, 'backup.zip')
      await writeBackupZip(zipPath, backupPath, imagesDir, { theme: 'system' })

      const outputDir = join(root, 'imported')
      await mkdir(outputDir, { recursive: true })
      await extractBackupZip(zipPath, outputDir)
      expect(existsSync(join(outputDir, 'taskmind.db'))).toBe(true)

      const imported = openDatabase(join(outputDir, 'taskmind.db'))
      const importedProjects = new ProjectService(imported)
      const importedTasks = new TaskService(imported, new StubMedia())
      const rows = imported
        .prepare('SELECT id, name, color FROM projects')
        .all() as Array<{ id: string; name: string; color: string }>
      expect(rows).toEqual([{ id: project.id, name: '备份项目', color: '#2563eb' }])

      const importedProject = importedProjects.list().find((item) => item.id === project.id)
      expect(importedProject?.name).toBe('备份项目')
      expect(importedProject?.color).toBe('#2563eb')
      expect(importedProject?.openTaskCount).toBe(1)
      expect(importedProject?.totalTaskCount).toBe(1)
      expect(importedTasks.get(task.id)?.projectId).toBe(project.id)
      expect(importedTasks.get(task.id)?.client).toBe('李姐')
      imported.close()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
