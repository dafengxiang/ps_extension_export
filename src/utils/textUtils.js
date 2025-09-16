/**
 * 文本处理相关工具函数
 */
const { getTextColor } = require('./colorUtils');

/**
 * 获取文本信息
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 文本信息对象
 */
async function getTextInfo(layer) {
    try {
        // 先检查是否是文本图层
        const isTextLayer = layer.kind === 'text' || 
                           layer.typename === 'ArtLayer' && layer.textItem ||
                           layer.layerType === 'text';
        
        if (isTextLayer) {
            let textInfo = {
                content: '',
                fontSize: null,
                fontFamily: null,
                color: null,
                justification: null,
                antiAliasMethod: null,
                leading: null,
                tracking: null,
                baseline: null,
                fontStyle: null
            };
            
            // 方法1: 通过textItem属性获取
            if (layer.textItem) {
                textInfo.content = layer.textItem.contents || '';
                textInfo.fontSize = layer.textItem.size || null;
                textInfo.fontFamily = layer.textItem.font || null;
                textInfo.color = getTextColor(layer.textItem);
                textInfo.justification = layer.textItem.justification || null;
                textInfo.antiAliasMethod = layer.textItem.antiAliasMethod || null;
                
                // 尝试获取更多文本属性
                try {
                    textInfo.leading = layer.textItem.leading || null;
                    textInfo.tracking = layer.textItem.tracking || null;
                    textInfo.baseline = layer.textItem.baseline || null;
                } catch (e) {
                    console.log("获取额外文本属性失败:", e.message);
                }
            }
            
            // 方法2: 如果方法1失败，使用脚本方式获取文本内容
            if (!textInfo.content) {
                try {
                    const { app, core } = require("photoshop");
        
                    const result = await core.executeAsModal(async () => {
                        const activeLayer = app.activeDocument.activeLayers[0];
                        const textInfo = {};
        
                        if (activeLayer && activeLayer.kind === "textLayer") {
                            try {
                                textInfo.content = activeLayer.textItem.contents;
                            } catch (e) {}
        
                            try {
                                textInfo.fontSize = activeLayer.textItem.size;
                            } catch (e) {}
        
                            try {
                                textInfo.fontFamily = activeLayer.textItem.font;
                            } catch (e) {}
        
                            try {
                                textInfo.justification = activeLayer.textItem.justification?.toString();
                            } catch (e) {}
        
                            try {
                                textInfo.leading = activeLayer.textItem.leading;
                            } catch (e) {}
        
                            try {
                                textInfo.tracking = activeLayer.textItem.tracking;
                            } catch (e) {}
        
                            try {
                                textInfo.antiAliasMethod = activeLayer.textItem.antiAliasMethod;
                            } catch (e) {}
        
                            // 颜色
                            try {
                                const textColor = activeLayer.textItem.color;
                                if (textColor?.rgb) {
                                    textInfo.color = {
                                        red: textColor.rgb.red,
                                        green: textColor.rgb.green,
                                        blue: textColor.rgb.blue
                                    };
                                }
                            } catch (e) {}
                        }
        
                        return textInfo;
                    }, { commandName: "Get Text Info" });
        
                    if (result) {
                        textInfo.content = result.content || textInfo.content;
                        textInfo.fontSize = result.fontSize || textInfo.fontSize;
                        textInfo.fontFamily = result.fontFamily || textInfo.fontFamily;
                        textInfo.justification = result.justification || textInfo.justification;
                        textInfo.leading = result.leading || textInfo.leading;
                        textInfo.tracking = result.tracking || textInfo.tracking;
                        textInfo.antiAliasMethod = result.antiAliasMethod || textInfo.antiAliasMethod;
        
                        if (result.color) {
                            const { rgbToHex } = require('./colorUtils');
                            textInfo.color = {
                                ...result.color,
                                hex: rgbToHex(result.color.red, result.color.green, result.color.blue)
                            };
                        }
                    }
                } catch (e) {
                    console.log("脚本获取文本信息失败:", e.message);
                }
            }
            
            // 方法3: 如果还是没有文本内容，尝试从图层名称获取
            if (!textInfo.content && layer.name) {
                // 有时图层名称就是文本内容
                textInfo.content = layer.name;
                textInfo.contentSource = 'layerName';
            }
            
            // 确保至少有基本的文本信息
            if (!textInfo.content) {
                textInfo.content = '[无法获取文本内容]';
                textInfo.contentSource = 'fallback';
            }
            
            // 添加文本图层标识
            textInfo.isTextLayer = true;
            textInfo.hasTextContent = !!textInfo.content && textInfo.content !== '[无法获取文本内容]';
            
            return textInfo;
        }
        return null;
    } catch (error) {
        console.error("获取文本信息失败:", error);
        
        // 即使出错，也尝试返回基本信息
        if (layer.kind === 'text' || (layer.textItem && layer.textItem.contents)) {
            return {
                content: layer.textItem?.contents || layer.name || '[获取失败]',
                isTextLayer: true,
                hasTextContent: false,
                error: error.message
            };
        }
        
        return null;
    }
}

module.exports = {
    getTextInfo
};
