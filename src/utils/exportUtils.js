/**
 * 图层导出相关工具函数
 */
const fs = require('uxp').storage.localFileSystem;
const { app, core, action } = require("photoshop");

/**
 * 保存图层为 PNG 文件
 * @param {Layer} layer - Photoshop 图层对象
 * @param {Folder} outputDir - 输出目录（可选，不传则弹窗选择）
 * @param {string} filename - 文件名（可选，不传则自动生成）
 * @returns {Promise<string>} - 文件的本地路径
 */
async function saveLayerAsImage(layer, outputDir = null, filename = null) {
    try {
        // 设置默认文件名
        if (!filename) {
            const cleanName = layer.name.replace(/[<>:"/\\|?*]/g, "_");
            filename = `${cleanName}_${Date.now()}.png`;
        }
        if (!filename.toLowerCase().endsWith(".png")) {
            filename += ".png";
        }

        console.log("开始保存图层:", layer.name, "文件名:", filename);

        // 如果没有传目录，就让用户选择一个
        let folder = outputDir;
        if (!folder) {
            folder = await fs.getFolder(); // 用户手动选目录
            if (!folder) throw new Error("用户取消了目录选择");
        }

        // 创建一个占位文件，稍后导出覆盖
        const file = await folder.createFile(filename, { overwrite: true });
        const outputPath = file.nativePath;

        await core.executeAsModal(async () => {
            const doc = app.activeDocument;

            // 记录图层可见性，并只显示目标图层
            const originalStates = [];
            for (const l of doc.layers) {
                originalStates.push({ layer: l, visible: l.visible });
                l.visible = (l === layer);
            }

            try {
                // 用 batchPlay 导出为 PNG
                await action.batchPlay(
                    [
                        {
                            _obj: "exportSelectionAsFileTypePressed",
                            fileType: "png",
                            quality: 32,
                            metadata: 0,
                            destFolder: outputPath.replace(/\\/g, "/"), // 路径要标准化
                            sRGB: true,
                            openWindow: false,
                            _options: { dialogOptions: "dontDisplay" }
                        }
                    ],
                    {
                        synchronousExecution: true,
                        modalBehavior: "execute"
                    }
                );
            } finally {
                // 恢复图层可见性
                for (const { layer: l, visible } of originalStates) {
                    l.visible = visible;
                }
            }
        }, { commandName: "Export Layer as Image" });

        console.log(`图片已保存到: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error("保存图层为图片失败:", error);
        throw error;
    }
}

module.exports = {
    saveLayerAsImage
};
