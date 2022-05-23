const fs = require("fs");
const path = require("path")

copyReadme()
prepareAndCopyPackage()

function copyReadme() {
    fs.copyFile(path.resolve(__dirname, "README.md"), path.resolve(__dirname, "dist/README.md"), err => {
        if (err) throw err;
        console.log('README.md copied');
    })
}

function prepareAndCopyPackage() {
    const copy = getCopy()
    const prepared = prepareToDist(copy)
    paste(prepared, err => {
        if (err) throw err;
        console.log('package.json setup');
    })

    function getCopy() {
        const copy = fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8");
        return JSON.parse(copy);
    }

    function prepareToDist(copy) {
        delete copy.scripts
        delete copy.dependencies
        delete copy.devDependencies
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