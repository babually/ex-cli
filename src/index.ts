import { 
    isCancel, 
    outro, 
    text, 
    select, 
    spinner, 
    confirm, 
    intro,
    cancel,
    progress
} from '@clack/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import path from 'path';
import fs from "fs-extra";
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { execSync } from 'child_process';

type FrontendStack = "react" | "nextjs";
type BackendStack = "hono" | "node-ts";
type PackageManager = "pnpm" | "npm" | "yarn";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_DIR = fs.existsSync(path.join(__dirname, "../templates"))
  ? path.join(__dirname, "../templates")
  : path.join(__dirname, "templates");


async function renderTemplates(
  templatePath: string,
  destinationPath: string,
  context: Record<string, any>
) {
  await fs.ensureDir(destinationPath);
  const entries = await fs.readdir(templatePath, { withFileTypes: true });

  for (const entry of entries) {
    const src = path.join(templatePath, entry.name);
    const dest = path.join(destinationPath, entry.name.replace(/\.hbs$/, ""));

    if (entry.isDirectory()) {
      await renderTemplates(src, dest, context);
    } else if (entry.name.endsWith(".hbs")) {
      try {
        const content = await fs.readFile(src, "utf8");
        const template = Handlebars.compile(content);
        const rendered = template(context);
        await fs.outputFile(dest, rendered);
      } catch (err) {
        console.log(`❌ Failed to compile template: ${src}`);
        throw err;
      }
    } else {
      await fs.copy(src, dest);
    }
  }
}

async function main() {
    try {
        console.log(
            chalk.hex("#ff69b4")
                (figlet.textSync("Ex-CLI", {
                    font: "Graffiti",
                    width: 80,
                    whitespaceBreak: true
                })
            )
        ) 
    } catch(err) {
        console.log("Something went wrong..")
        console.dir(err)
    }

    intro("Welocome to Ex-CLI...!");

    const name = await text({
        message: 'What is your project name?',
        placeholder: 'my-app',
        initialValue: "my-app",
        // validate: (value) => {
        //     if (!value) return "Project name is requerd";
        // }
    });
    
    if(isCancel(name)) {
        outro("Operation cancelled.")
        process.exit(0);
    }

    const projectType = await select({
        message: 'Pick a project type.',
        options: [
            { 
                value: 'frontend', 
                label: 'Front-end' 
            },
            { 
                value: 'backend', 
                label: 'Back-end', 
                disabled: true 
            },
        ],
    });

    if (isCancel(projectType)) {
        outro('Operation cancelled.');
        process.exit(0);
    }

    let frontend: FrontendStack | null = null;
    let backend: BackendStack | null = null;

    if (projectType === "frontend" ) {
        const frontendChoice = await select({
        message: "Choose a frontend framework:",
            options: [
                {
                    label: chalk.hex("#1dc4e9")("React"),
                    value: "react",
                    hint: "vite+ts",
                },
                {
                    label: chalk.white("Next.js"),
                    value: "nextjs",
                    hint: "+ TailwindCSS",
                },
            ],
        });
        if (isCancel(frontendChoice)) return cancel("Operation cancelled.");
        frontend = frontendChoice as FrontendStack;
    } 

    if (projectType === "backend") {
        const backendChoice = await select({
        message: "Choose a backend framework:",
            options: [
                {
                label: chalk.hex("#ff6a00")("Hono🔥"),
                value: "hono",
                },
                {
                label: chalk.green("node-ts"),
                value: "node-ts",
                hint: "Node + Express + TypeScript",
                },
            ],
        });
        if (isCancel(backendChoice)) return cancel("Operation cancelled.");
        backend = backendChoice as BackendStack;
    }

    const installDeps = await confirm({
        message: "Install dependencies after setup?",
        initialValue: true,
    });
    if (isCancel(installDeps)) return cancel("Operation cancelled.");

    let packageManager: PackageManager = "npm";
    if (installDeps) {
        const pm = await select({
        message: "Choose a package manager:",
        options: [
            { label: chalk.yellow("pnpm"), value: "pnpm" },
            { label: chalk.red("npm"), value: "npm" },
            { label: chalk.cyan("yarn"), value: "yarn" },
        ],
        initialValue: "pnpm",
        });
        if (isCancel(pm)) return cancel("Operation cancelled.");
        packageManager = pm as PackageManager;
    }

    const context = { name };
    const sanitizedName = name.replace(/\s+/g, "-");
    const projectPath = path.join(process.cwd(), sanitizedName);

    try {
        if (projectType === "frontend") {
            const src = path.join(TEMPLATE_DIR, "frontend", frontend!);
            if (!(await fs.pathExists(src)))
                return cancel(`❌ Template not found: ${src}`);
            const s = spinner();
            s.start("📦 Rendering frontend template...");
            await renderTemplates(src, projectPath, context);
            s.stop("✅ Frontend template rendered.");
        } else if (projectType === "backend") {
            const src = path.join(TEMPLATE_DIR, "backend", backend!);
            if (!(await fs.pathExists(src)))
                return cancel(`❌ Template not found: ${src}`);
            const s = spinner();
            s.start("📦 Rendering backend template...");
            await renderTemplates(src, projectPath, context);
            s.stop("✅ Backend template rendered.");
        } 
    
        const shouldContinue = await confirm({
            message: `Create project "${name}" as a ${projectType} project?`,
        });

        if (isCancel(shouldContinue) || !shouldContinue) {
            outro('Operation cancelled.');
            process.exit(0);
        }

        // const s = spinner();
        // s.start('Creating project...');
        // Simulate an asynchronous task

        const sGit = spinner();
        sGit.start("🔧 Initializing git repository...");
        execSync(`git init`, { stdio: "ignore", cwd: projectPath });
        sGit.stop("✅ Git repository initialized.");
        
        // await new Promise(resolve => setTimeout(resolve, 1000));
        // s.stop('Project created!');

        const depSpin = spinner();
        depSpin.start("📦 Installing dependencies...");
        execSync(`${packageManager} install`, {
          stdio: "inherit",
          cwd: projectPath,
        });
        depSpin.stop("✅ Dependencies installed.");

        const files = ['package.json', 'README.md', 'src/index.ts', 'tsconfig.json', 'LICENSE'];

        const prog = progress({
            style: "heavy",
            max: files.length,
            size: 30
        });

        prog.start('Downloading files');

        for (let i = 0; i < files.length; i++) {
            // Simulate download
            await new Promise(resolve => setTimeout(resolve, 500));
            prog.advance(1, `Downloaded ${files[i]}`);
        }

        prog.stop('All files downloaded');

        outro('Downloading completed..!');



        outro('Setup complete! Have fun.');
    } catch(err) {
        cancel("❌ Setup failed.");
        console.error(err);
    } 
}

main();
