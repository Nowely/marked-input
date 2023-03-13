import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import api from '@microsoft/api-extractor'


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

copyReadme()
prepareAndCopyPackage()
rollupTypes()
removeExtraTypeDeclarations()


function copyReadme() {
    fs.copyFile(path.resolve(__dirname, "README.md"), path.resolve(__dirname, "dist/README.md"), err => {
        if (err) throw err;
        console.log('README.md copied');
    })
}

function prepareAndCopyPackage() {
    const mainPackage = getPackageCopy()
    const libPackage = getPackageCopy("lib")
    deleteUnnecessaryProperties(mainPackage)
    mainPackage.peerDependencies = libPackage.peerDependencies
    mainPackage.name = libPackage.name
    paste(mainPackage, err => {
        if (err) throw err;
        console.log('package.json setup');
    })

    function getPackageCopy(pathSegment = "") {
        const copy = fs.readFileSync(path.resolve(__dirname, pathSegment, "package.json"), "utf-8");
        return JSON.parse(copy);
    }

    function deleteUnnecessaryProperties(copy) {
        delete copy.private
        delete copy.scripts
        delete copy.dependencies
        delete copy.devDependencies
        delete copy.workspaces
        return copy
    }

    function paste(obj, callback) {
        try {
            fs.writeFileSync(path.resolve(__dirname, "dist/package.json"), Buffer.from(JSON.stringify(obj, null, 2), "utf-8"))
            callback(null)
        } catch (err) {
            callback(err)
        }
    }
}

function rollupTypes() {
    console.log('Start rollup types:')

    const config = api.ExtractorConfig.prepare(getOptions())
    const result = api.Extractor.invoke(config, {showVerboseMessages: true})
    if (result.succeeded) {
        console.log(`Types rollup completed successfully`)
        process.exitCode = 0;
    } else {
        console.error(`Types rollup completed with ${result.errorCount} errors and ${result.warningCount} warnings`)
        process.exitCode = 1;
    }


    function getOptions() {
        const configObjectFullPath = __filename
        const packageJsonFullPath = path.resolve(__dirname, `package.json`)

        /** @type api.IConfigFile */
        const configObject = {
            projectFolder: path.resolve(__dirname),
            mainEntryPointFilePath: "<projectFolder>/dist/types/index.d.ts",
            compiler: {tsconfigFilePath: "<projectFolder>/tsconfig.json"},
            dtsRollup: {
                enabled: true,
                untrimmedFilePath: "<projectFolder>/dist/index.d.ts"
            },
            messages: {
                compilerMessageReporting: {
                    default: {logLevel: "warning"},
                },
                //ae - prefix
                extractorMessageReporting: {
                    default: {logLevel: "warning"},
                    "ae-missing-release-tag": {logLevel: "none"},
                },
                //tsdoc = prefix
                tsdocMessageReporting: {
                    default: {logLevel: "warning"},
                    "tsdoc-undefined-tag": {logLevel: "none"},
                    "tsdoc-characters-after-block-tag": {logLevel: "none"},
                    "tsdoc-at-sign-in-word": {logLevel: "none"},
                }
            }
        }
        return {configObject, configObjectFullPath, packageJsonFullPath}
    }
}

function removeExtraTypeDeclarations() {
    fs.rm(path.resolve(__dirname, "dist/types"), { recursive: true }, (err) => {
        if (err) throw err;
        console.log('Extra declarations deleted');
    });
}
