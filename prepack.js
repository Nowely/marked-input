import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

copyReadme()
prepareAndCopyPackage()

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
    paste(mainPackage, err => {
        if (err) throw err;
        console.log('package.json setup');
    })

    function getPackageCopy(pathSegment = "") {
        const copy = fs.readFileSync(path.resolve(__dirname, pathSegment, "package.json"), "utf-8");
        return JSON.parse(copy);
    }

    function deleteUnnecessaryProperties(copy) {
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