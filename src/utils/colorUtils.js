/**
 * 颜色处理相关工具函数
 */

/**
 * RGB转十六进制
 * @param {number} r - 红色值 (0-255)
 * @param {number} g - 绿色值 (0-255)
 * @param {number} b - 蓝色值 (0-255)
 * @returns {string} 十六进制颜色值
 */
function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

/**
 * 转换颜色对象为标准格式
 * @param {Object} color - PS颜色对象
 * @returns {Object|null} 标准化的颜色对象
 */
function convertColorToObject(color) {
    try {
        if (!color) return null;
        
        let colorObj = { red: 0, green: 0, blue: 0 };
        
        // 处理不同的颜色格式
        if (color.rgb) {
            colorObj = {
                red: color.rgb.red || 0,
                green: color.rgb.green || 0,
                blue: color.rgb.blue || 0
            };
        } else if (typeof color.red !== 'undefined') {
            colorObj = {
                red: color.red || 0,
                green: color.green || 0,
                blue: color.blue || 0
            };
        }
        
        // 添加十六进制表示
        colorObj.hex = rgbToHex(colorObj.red, colorObj.green, colorObj.blue);
        
        return colorObj;
    } catch (error) {
        console.error("转换颜色对象失败:", error);
        return null;
    }
}

/**
 * 获取文本颜色
 * @param {Object} textItem - PS文本项对象
 * @returns {Object|null} 颜色对象
 */
function getTextColor(textItem) {
    try {
        if (textItem && textItem.color) {
            const color = textItem.color;
            return {
                red: color.rgb?.red || 0,
                green: color.rgb?.green || 0,
                blue: color.rgb?.blue || 0,
                hex: rgbToHex(color.rgb?.red || 0, color.rgb?.green || 0, color.rgb?.blue || 0)
            };
        }
        return null;
    } catch (error) {
        console.error("获取文本颜色失败:", error);
        return null;
    }
}

/**
 * 获取图层颜色汇总信息
 * @param {Object} layerInfo - 图层信息对象
 * @returns {Object|null} 颜色汇总对象
 */
function getLayerColorSummary(layerInfo) {
    try {
        const summary = {
            hasColors: false,
            fillColor: null,
            strokeColor: null,
            textColor: null
        };
        
        // 从样式中获取颜色
        if (layerInfo.styles?.colors) {
            if (layerInfo.styles.colors.fill) {
                summary.fillColor = layerInfo.styles.colors.fill;
                summary.hasColors = true;
            }
            if (layerInfo.styles.colors.stroke) {
                summary.strokeColor = layerInfo.styles.colors.stroke;
                summary.hasColors = true;
            }
        }
        
        // 从形状信息中获取颜色
        if (layerInfo.shapeInfo?.colors) {
            if (layerInfo.shapeInfo.colors.fill) {
                summary.fillColor = layerInfo.shapeInfo.colors.fill;
                summary.hasColors = true;
            }
            if (layerInfo.shapeInfo.colors.stroke) {
                summary.strokeColor = layerInfo.shapeInfo.colors.stroke;
                summary.hasColors = true;
            }
        }
        
        // 从文本信息中获取颜色
        if (layerInfo.textInfo?.color) {
            summary.textColor = layerInfo.textInfo.color;
            summary.hasColors = true;
        }
        
        return summary.hasColors ? summary : null;
    } catch (error) {
        console.error("获取图层颜色汇总失败:", error);
        return null;
    }
}

/**
 * 获取图层颜色信息
 * @param {Object} layer - PS图层对象
 * @returns {Object|null} 颜色信息对象
 */
async function getLayerColors(layer) {
    try {
        const colors = {
            fill: null,
            stroke: null,
            background: null,
            foreground: null
        };
        
        // 尝试多种方法获取颜色信息
        
        // 方法1: 通过图层样式获取
        if (layer.layerEffects) {
            // 获取描边颜色
            if (layer.layerEffects.stroke && layer.layerEffects.stroke.color) {
                colors.stroke = convertColorToObject(layer.layerEffects.stroke.color);
            }
            
            // 获取颜色叠加
            if (layer.layerEffects.colorOverlay && layer.layerEffects.colorOverlay.color) {
                colors.fill = convertColorToObject(layer.layerEffects.colorOverlay.color);
            }
        }
        
        // 方法2: 对于形状图层获取填充色
        if (layer.kind === 'shape' || layer.typename === 'ArtLayer') {
            try {
                // 尝试获取形状填充颜色
                if (layer.adjustments && layer.adjustments.solidColor) {
                    colors.fill = convertColorToObject(layer.adjustments.solidColor);
                }
                
                // 尝试通过vectorMask获取颜色
                if (layer.vectorMask && layer.vectorMask.fillColor) {
                    colors.fill = convertColorToObject(layer.vectorMask.fillColor);
                }
            } catch (e) {
                console.log("获取形状颜色失败:", e.message);
            }
        }
        
        // 方法3: 使用脚本方式获取颜色（简化版本）
        try {
            const { app, core } = require("photoshop");

            const result = await core.executeAsModal(async () => {
                const colorInfo = {};

                try {
                    const fg = app.foregroundColor.rgb;
                    colorInfo.foreground = {
                        red: fg.red,
                        green: fg.green,
                        blue: fg.blue
                    };
                } catch (e) {}

                try {
                    const bg = app.backgroundColor.rgb;
                    colorInfo.background = {
                        red: bg.red,
                        green: bg.green,
                        blue: bg.blue
                    };
                } catch (e) {}

                return colorInfo;
            }, { commandName: "Get Layer Colors" });

            if (result) {
                if (result.foreground) {
                    colors.foreground = {
                        ...result.foreground,
                        hex: rgbToHex(result.foreground.red, result.foreground.green, result.foreground.blue)
                    };
                }
                if (result.background) {
                    colors.background = {
                        ...result.background,
                        hex: rgbToHex(result.background.red, result.background.green, result.background.blue)
                    };
                }
            }
        } catch (e) {
            console.log("脚本获取颜色失败:", e.message);
        }
        
        return colors;
    } catch (error) {
        console.error("获取图层颜色失败:", error);
        return null;
    }
}

module.exports = {
    rgbToHex,
    convertColorToObject,
    getTextColor,
    getLayerColorSummary,
    getLayerColors
};
