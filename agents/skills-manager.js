'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const engineConfig = require('./engine-config');

const readdirAsync = util.promisify(fs.readdir);
const readFileAsync = util.promisify(fs.readFile);

const matter = require('gray-matter');

/**
 * Parses a YAML frontmatter from a markdown string using gray-matter.
 */
function parseSkillFile(content) {
    try {
        const parsed = matter(content);
        return {
            name: parsed.data?.name || '',
            description: parsed.data?.description || '',
            body: parsed.content
        };
    } catch (e) {
        console.error('[SkillsManager] Failed to parse frontmatter:', e.message);
        return { name: '', description: '', body: content };
    }
}

async function migrateLegacySkills(workspace) {
    const legacyDir = path.join(workspace, '.gemini', 'skills');
    const newDir = path.join(workspace, 'skills');

    if (!fs.existsSync(legacyDir)) return;

    try {
        if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir, { recursive: true });
        }

        const dirs = await readdirAsync(legacyDir, { withFileTypes: true });
        for (const dirent of dirs) {
            if (dirent.isDirectory()) {
                const srcPath = path.join(legacyDir, dirent.name);
                const destPath = path.join(newDir, dirent.name);
                
                // Only move if it doesn't already exist in the new directory
                if (!fs.existsSync(destPath)) {
                    fs.renameSync(srcPath, destPath);
                    console.log(`[SkillsManager] Migrated legacy skill: ${dirent.name}`);
                }
            }
        }
    } catch (e) {
        console.error('[SkillsManager] Legacy migration failed:', e.message);
    }
}

/**
 * Dynamically scans the workspace's skills directory 
 * and parses all available SKILL.md files.
 * @returns {Promise<{ name: string, status: string, description: string }[]>}
 */
async function getSystemSkillsAsync() {
    try {
        const workspace = engineConfig.getWorkspacePath();
        if (!workspace) return [];

        await migrateLegacySkills(workspace);

        const skillsDir = path.join(workspace, 'skills');
        if (!fs.existsSync(skillsDir)) return [];

        const dirs = await readdirAsync(skillsDir, { withFileTypes: true });
        const skills = [];

        for (const dirent of dirs) {
            if (dirent.isDirectory()) {
                const skillNameDir = dirent.name;
                const skillPath = path.join(skillsDir, skillNameDir, 'SKILL.md');
                
                if (fs.existsSync(skillPath)) {
                    const content = await readFileAsync(skillPath, 'utf8');
                    const parsed = parseSkillFile(content);
                    
                    skills.push({
                        id: skillNameDir,
                        name: parsed.name || skillNameDir,
                        status: 'OK', // Assuming OK if file exists
                        description: parsed.description || 'No description provided.'
                    });
                }
            }
        }

        return skills;
    } catch (e) {
        console.error('[SkillsManager] Failed to get system skills:', e.message);
        return [];
    }
}

/**
 * Retrieves the raw content of a specific skill's SKILL.md, 
 * stripping out the YAML frontmatter.
 */
function getSkillContent(skillName) {
    try {
        const workspace = engineConfig.getWorkspacePath();
        if (!workspace) return null;

        const skillsDir = path.join(workspace, 'skills');
        const skillPath = path.join(skillsDir, skillName, 'SKILL.md');

        if (fs.existsSync(skillPath)) {
            const content = fs.readFileSync(skillPath, 'utf8');
            const parsed = parseSkillFile(content);
            return parsed.body;
        }
        return null;
    } catch (e) {
        console.error(`[SkillsManager] Failed to get skill content for ${skillName}:`, e.message);
        return null;
    }
}

module.exports = {
    getSystemSkillsAsync,
    getSkillContent
};
