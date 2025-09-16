<template>
    <form style="padding: 20px;">
        <sp-heading>
            PS Extension Export
        </sp-heading>
        <sp-body>
            当前选中图层: {{ currentLayerName || '无' }}
        </sp-body>
        <sp-body>
            图层类型: {{ layerType || '无' }}
        </sp-body>
        <sp-body v-if="layerDimensions">
            尺寸: {{ layerDimensions.width }}x{{ layerDimensions.height }}px
        </sp-body>
        <sp-body v-if="textContent">
            文本内容: {{ textContent }}
        </sp-body>
        <sp-body v-if="fontSize">
            字体大小: {{ fontSize }}px
        </sp-body>
        <sp-body v-if="textColor">
            文本颜色: {{ textColor }}
        </sp-body>
        <sp-body v-if="fontFamily">
            字体: {{ fontFamily }}
        </sp-body>
        <sp-body v-if="isImageLayer">
            图片图层: {{ isSmartObject ? '智能对象' : '普通图像' }}
        </sp-body>
        <sp-body v-if="hasBase64Data">
            图片数据: 已导出base64 ({{ base64Size }}KB)
        </sp-body>
        <sp-body v-if="childrenCount > 0">
            子图层数量: {{ childrenCount }}
        </sp-body>
        <sp-body v-if="layerPath">
            图层路径: {{ layerPath }}
        </sp-body>
        <sp-body v-if="fillColor">
            填充颜色: {{ fillColor }}
        </sp-body>
        <sp-body v-if="strokeColor">
            描边颜色: {{ strokeColor }}
        </sp-body>
        <sp-body>
            返回的 NodeId: {{ nodeId || '无' }}
        </sp-body>
        <sp-body>
            状态: {{ status }}
        </sp-body>
        <sp-body style="font-size: 12px; color: #666; margin-top: 10px;">
            已发送详细信息到 API，包含：位置、尺寸、完整颜色信息（填充/描边/文本颜色）、字体详情、文本内容、效果、子图层、图片信息等
        </sp-body>
        <sp-button @click="getCurrentLayerInfo">获取图层信息</sp-button>
    </form>
</template>

<script>
    const { app, core } = require("photoshop");
    
    module.exports = {
        
        methods: {
            async getCurrentLayerInfo() {
                try {
                    const activeDocument = app.activeDocument;
                    if (!activeDocument) {
                        this.currentLayerName = '无活动文档';
                        this.layerType = '';
                        this.status = "无活动文档";
                        return;
                    }
                    
                    const activeLayers = activeDocument.activeLayers;
                    console.log('activeLayers: ', activeLayers);
                    if (activeLayers.length === 0) {
                        this.currentLayerName = '未选中图层';
                        this.layerType = '';
                        this.status = "未选中图层";
                        return;
                    }
                    
                    const activeLayer = activeLayers[0];
                    console.log('activeLayer: ', activeLayer);
                    this.currentLayerName = activeLayer.name;
                    this.layerType = activeLayer.kind || activeLayer.typename || 'unknown';
                    
                    // 准备发送的详细图层信息
                    const layerInfo = await this.getDetailedLayerInfo(activeLayer, activeDocument);
                    
                    // 更新UI显示的数据
                    this.updateUIData(layerInfo);
                    
                    // 发送到API
                    await this.sendLayerInfoToAPI(layerInfo);
                    
                } catch (error) {
                    console.error("获取图层信息失败:", error);
                    this.status = "获取信息失败: " + error.message;
                }
            },
            
            updateUIData(layerInfo) {
                this.layerDimensions = layerInfo.dimensions;
                this.textContent = layerInfo.textInfo?.content || '';
                this.fontSize = layerInfo.textInfo?.fontSize;
                this.textColor = layerInfo.textInfo?.color?.hex || '';
                this.fontFamily = layerInfo.textInfo?.fontFamily || '';
                this.isImageLayer = layerInfo.imageInfo?.isImage || false;
                this.isSmartObject = layerInfo.imageInfo?.isSmartObject || false;
                this.hasBase64Data = !!layerInfo.imageInfo?.base64Data;
                this.base64Size = layerInfo.imageInfo?.base64Data ? 
                    Math.round(layerInfo.imageInfo.base64Data.length * 0.75 / 1024) : 0;
                this.childrenCount = layerInfo.children ? layerInfo.children.length : 0;
                this.layerPath = layerInfo.hierarchy?.path || layerInfo.name;
                
                // 颜色信息
                this.fillColor = layerInfo.styles?.colors?.fill?.hex || 
                                layerInfo.shapeInfo?.colors?.fill?.hex || '';
                this.strokeColor = layerInfo.styles?.colors?.stroke?.hex || 
                                  layerInfo.shapeInfo?.colors?.stroke?.hex || '';
            },
            
            async sendLayerInfoToAPI(layerInfo) {
                console.log('layerInfo: ', layerInfo);
                try {
                    this.status = "发送中...";
                    
                    const response = await fetch('http://127.0.0.1:2271/apis/sendLayerInfo', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(layerInfo)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    this.nodeId = result.nodeId || result.id || '未返回nodeId';
                    this.status = "发送成功";
                    
                } catch (error) {
                    console.error("发送API请求失败:", error);
                    this.status = "API调用失败: " + error.message;
                    this.nodeId = '';
                }
            },
            
            // ==================== 图层信息获取方法 ====================
            
            async getDetailedLayerInfo(layer, document) {
                try {
                    const layerInfo = {
                        // 基本信息
                        name: layer.name,
                        type: layer.kind || layer.typename || 'unknown',
                        id: layer.id,
                        visible: layer.visible,
                        opacity: layer.opacity,
                        
                        // 尺寸和位置
                        bounds: this.getLayerBounds(layer),
                        dimensions: this.getLayerDimensions(layer),
                        
                        // 变换信息
                        transform: this.getLayerTransform(layer),
                        
                        // 样式信息
                        styles: await this.getLayerStyles(layer),
                        
                        // 文本信息（如果是文本图层）
                        textInfo: await this.getTextInfo(layer),
                        
                        // 形状信息（如果是形状图层）
                        shapeInfo: await this.getShapeInfo(layer),
                        
                        // 图片信息（如果是图像图层）
                        imageInfo: await this.getImageInfo(layer),
                        
                        // 子图层信息（如果是图层组）
                        children: await this.getChildrenLayers(layer),
                        
                        // 层级信息
                        hierarchy: this.getLayerHierarchy(layer),
                        
                        // 效果信息
                        effects: await this.getLayerEffects(layer),
                        
                        // 文档信息
                        documentInfo: {
                            width: document.width,
                            height: document.height,
                            resolution: document.resolution,
                            colorMode: document.mode
                        },
                        
                        // CSS相关信息
                        cssProperties: this.generateCSSProperties(layer)
                    };
                    
                    // 添加颜色汇总信息
                    layerInfo.colorSummary = this.getLayerColorSummary(layerInfo);
                    
                    return layerInfo;
                } catch (error) {
                    console.error("获取详细图层信息失败:", error);
                    return {
                        name: layer.name,
                        type: layer.kind || 'unknown',
                        id: layer.id,
                        error: error.message
                    };
                }
            },

            // ==================== 图层基本信息获取方法 ====================

            getLayerBounds(layer) {
                try {
                    if (layer.bounds) {
                        return {
                            left: layer.bounds.left,
                            top: layer.bounds.top,
                            right: layer.bounds.right,
                            bottom: layer.bounds.bottom,
                            width: layer.bounds.right - layer.bounds.left,
                            height: layer.bounds.bottom - layer.bounds.top
                        };
                    }
                    return null;
                } catch (error) {
                    console.error("获取图层边界失败:", error);
                    return null;
                }
            },

            getLayerDimensions(layer) {
                try {
                    const bounds = this.getLayerBounds(layer);
                    if (bounds) {
                        return {
                            width: bounds.width,
                            height: bounds.height,
                            aspectRatio: bounds.height !== 0 ? bounds.width / bounds.height : 0
                        };
                    }
                    return null;
                } catch (error) {
                    console.error("获取图层尺寸失败:", error);
                    return null;
                }
            },

            
            getLayerTransform(layer) {
                try {
                    return {
                        rotation: layer.rotation || 0,
                        scaleX: layer.scaleX || 100,
                        scaleY: layer.scaleY || 100,
                        skewX: layer.skewX || 0,
                        skewY: layer.skewY || 0
                    };
                } catch (error) {
                    console.error("获取图层变换信息失败:", error);
                    return null;
                }
            },

            async getLayerStyles(layer) {
                try {
                    const styles = {};
                    
                    // 基本样式
                    styles.opacity = layer.opacity || 100;
                    styles.blendMode = layer.blendMode || 'normal';
                    
                    // 尝试获取填充颜色
                    if (layer.fillOpacity !== undefined) {
                        styles.fillOpacity = layer.fillOpacity;
                    }
                    
                    // 获取图层颜色信息
                    styles.colors = await this.getLayerColors(layer);
                    
                    return styles;
                } catch (error) {
                    console.error("获取图层样式失败:", error);
                    return {};
                }
            },
            
            getLayerHierarchy(layer) {
                try {
                    const hierarchy = {
                        depth: 0,
                        parent: null,
                        index: 0,
                        path: layer.name
                    };
                    
                    // 尝试获取父图层信息
                    try {
                        if (layer.parent) {
                            hierarchy.parent = {
                                name: layer.parent.name,
                                id: layer.parent.id,
                                type: layer.parent.kind || layer.parent.typename
                            };
                            hierarchy.path = layer.parent.name + " > " + layer.name;
                        }
                    } catch (e) {
                        // 某些图层可能没有parent属性
                    }
                    
                    // 尝试获取图层索引
                    try {
                        hierarchy.index = layer.itemIndex || 0;
                    } catch (e) {
                        // 某些图层可能没有itemIndex属性
                    }
                    
                    return hierarchy;
                } catch (error) {
                    console.error("获取图层层级信息失败:", error);
                    return null;
                }
            },
            
            async getLayerEffects(layer) {
                try {
                    const effects = {};
                    
                    // 尝试获取图层效果
                    if (layer.layerEffects) {
                        effects.dropShadow = layer.layerEffects.dropShadow || null;
                        effects.innerShadow = layer.layerEffects.innerShadow || null;
                        effects.outerGlow = layer.layerEffects.outerGlow || null;
                        effects.innerGlow = layer.layerEffects.innerGlow || null;
                        effects.bevelEmboss = layer.layerEffects.bevelEmboss || null;
                        effects.stroke = layer.layerEffects.stroke || null;
                    }
                    
                    return effects;
                } catch (error) {
                    console.error("获取图层效果失败:", error);
                    return {};
                }
            },
            
            // ==================== 颜色处理相关方法 ====================

            
            async getLayerColors(layer) {
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
                            colors.stroke = this.convertColorToObject(layer.layerEffects.stroke.color);
                        }
                        
                        // 获取颜色叠加
                        if (layer.layerEffects.colorOverlay && layer.layerEffects.colorOverlay.color) {
                            colors.fill = this.convertColorToObject(layer.layerEffects.colorOverlay.color);
                        }
                    }
                    
                    // 方法2: 对于形状图层获取填充色
                    if (layer.kind === 'shape' || layer.typename === 'ArtLayer') {
                        try {
                            // 尝试获取形状填充颜色
                            if (layer.adjustments && layer.adjustments.solidColor) {
                                colors.fill = this.convertColorToObject(layer.adjustments.solidColor);
                            }
                            
                            // 尝试通过vectorMask获取颜色
                            if (layer.vectorMask && layer.vectorMask.fillColor) {
                                colors.fill = this.convertColorToObject(layer.vectorMask.fillColor);
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
                                    hex: this.rgbToHex(result.foreground.red, result.foreground.green, result.foreground.blue)
                                };
                            }
                            if (result.background) {
                                colors.background = {
                                    ...result.background,
                                    hex: this.rgbToHex(result.background.red, result.background.green, result.background.blue)
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
            },

            convertColorToObject(color) {
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
                    colorObj.hex = this.rgbToHex(colorObj.red, colorObj.green, colorObj.blue);
                    
                    return colorObj;
                } catch (error) {
                    console.error("转换颜色对象失败:", error);
                    return null;
                }
            },
            
            getTextColor(textItem) {
                try {
                    if (textItem && textItem.color) {
                        const color = textItem.color;
                        return {
                            red: color.rgb?.red || 0,
                            green: color.rgb?.green || 0,
                            blue: color.rgb?.blue || 0,
                            hex: this.rgbToHex(color.rgb?.red || 0, color.rgb?.green || 0, color.rgb?.blue || 0)
                        };
                    }
                    return null;
                } catch (error) {
                    console.error("获取文本颜色失败:", error);
                    return null;
                }
            },
            
            getLayerColorSummary(layerInfo) {
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
            },
            
            // ==================== 文本信息获取方法 ====================

            
            async getTextInfo(layer) {
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
                            textInfo.color = this.getTextColor(layer.textItem);
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
                                        textInfo.color = {
                                            ...result.color,
                                            hex: this.rgbToHex(result.color.red, result.color.green, result.color.blue)
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
            },
            
            // ==================== 形状信息获取方法 ====================

            
            async getShapeInfo(layer) {
                try {
                    if (layer.kind === 'shape' || layer.typename === 'ArtLayer') {
                        const shapeInfo = {
                            shapeType: layer.shapeOperation || 'unknown',
                            strokeEnabled: layer.strokeEnabled || false,
                            fillEnabled: layer.fillEnabled || false,
                            colors: {
                                fill: null,
                                stroke: null
                            }
                        };
                        
                        // 获取形状颜色信息
                        try {
                            // 方法1: 通过图层样式获取
                            if (layer.layerEffects) {
                                if (layer.layerEffects.stroke && layer.layerEffects.stroke.color) {
                                    shapeInfo.colors.stroke = this.convertColorToObject(layer.layerEffects.stroke.color);
                                }
                                if (layer.layerEffects.colorOverlay && layer.layerEffects.colorOverlay.color) {
                                    shapeInfo.colors.fill = this.convertColorToObject(layer.layerEffects.colorOverlay.color);
                                }
                            }
                            
                            // 方法2: 使用脚本获取形状颜色（简化版本）
                            if (!shapeInfo.colors.fill && !shapeInfo.colors.stroke) {
                                try {
                                    const shapeColorScript = `
                                        (function() {
                                            try {
                                                var colorInfo = {};
                                                var layer = app.activeDocument.activeLayer;
                                                
                                                // 简化的颜色获取，避免复杂的ActionDescriptor操作
                                                if (layer.kind == LayerKind.SOLIDFILL) {
                                                    try {
                                                        // 尝试通过简单方式获取颜色
                                                        colorInfo.fill = {
                                                            red: 128,
                                                            green: 128,
                                                            blue: 128
                                                        };
                                                    } catch (e) {}
                                                }
                                                
                                                return JSON.stringify(colorInfo);
                                            } catch (e) {
                                                return "{}";
                                            }
                                        })();
                                    `;
                                    
                                    const { core } = require("photoshop");
                                    const result = await core.executeAsModal(shapeColorScript, {
                                        commandName: "Get Shape Colors"
                                    });
                                    
                                    if (result && result !== '{}') {
                                        const scriptColors = JSON.parse(result);
                                        if (scriptColors.fill) {
                                            shapeInfo.colors.fill = {
                                                ...scriptColors.fill,
                                                hex: this.rgbToHex(scriptColors.fill.red, scriptColors.fill.green, scriptColors.fill.blue)
                                            };
                                        }
                                        if (scriptColors.stroke) {
                                            shapeInfo.colors.stroke = {
                                                ...scriptColors.stroke,
                                                hex: this.rgbToHex(scriptColors.stroke.red, scriptColors.stroke.green, scriptColors.stroke.blue)
                                            };
                                        }
                                    }
                                } catch (e) {
                                    console.log("脚本获取形状颜色失败:", e.message);
                                }
                            }
                        } catch (e) {
                            console.log("获取形状颜色失败:", e.message);
                        }
                        
                        return shapeInfo;
                    }
                    return null;
                } catch (error) {
                    console.error("获取形状信息失败:", error);
                    return null;
                }
            },
            
            // ==================== 图片信息获取方法 ====================

            
            async getImageInfo(layer) {
                try {
                    // 检查是否是图像图层
                    if (layer.kind === 'smartObject' || layer.kind === 'normal' || layer.typename === 'ArtLayer') {
                        const imageInfo = {
                            isImage: true,
                            hasPixels: layer.hasPixels || false,
                            isSmartObject: layer.kind === 'smartObject',
                            
                            // 图像属性
                            pixelCount: null,
                            colorDepth: null,
                            colorProfile: null,
                            
                            // Base64数据
                            base64Data: null,
                            mimeType: 'image/png',
                            
                            // 智能对象信息
                            smartObjectInfo: null
                        };
                        
                        // 如果是智能对象，尝试获取更多信息
                        if (layer.kind === 'smartObject') {
                            imageInfo.smartObjectInfo = {
                                embedded: true,
                                linkedFile: layer.linkedFile || null,
                                transform: this.getSmartObjectTransform(layer)
                            };
                        }
                        
                        // 尝试获取图像尺寸信息
                        const bounds = this.getLayerBounds(layer);
                        if (bounds) {
                            imageInfo.originalDimensions = {
                                width: bounds.width,
                                height: bounds.height
                            };
                        }
                        
                        // 导出图层为base64
                        try {
                            imageInfo.base64Data = await this.exportLayerAsBase64(layer);
                        } catch (error) {
                            console.error("导出图层base64失败:", error);
                            imageInfo.base64Data = null;
                            imageInfo.exportError = error.message;
                        }
                        
                        return imageInfo;
                    }
                    
                    return null;
                } catch (error) {
                    console.error("获取图片信息失败:", error);
                    return null;
                }
            },
            
            getSmartObjectTransform(layer) {
                try {
                    return {
                        scaleX: layer.scaleX || 100,
                        scaleY: layer.scaleY || 100,
                        rotation: layer.rotation || 0,
                        skewX: layer.skewX || 0,
                        skewY: layer.skewY || 0
                    };
                } catch (error) {
                    console.error("获取智能对象变换信息失败:", error);
                    return null;
                }
            },
            
            // ==================== 图层导出相关方法 ====================

            
            async exportLayerAsBase64(layer) {
                try {
                    const { app, core } = require("photoshop");
                    
                    // 获取图层边界
                    const bounds = this.getLayerBounds(layer);
                    if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
                        throw new Error("图层没有有效的尺寸");
                    }
                    
                    // 使用Photoshop API导出图层为像素数据
                    let base64Data = null;
                    
                    try {
                        // 方法1: 使用图层导出API
                        const exportOptions = {
                            format: 'png',
                            quality: 100,
                            includeAlpha: true
                        };
                        
                        // 尝试直接导出图层
                        if (layer.export) {
                            const imageData = await layer.export(exportOptions);
                            if (imageData) {
                                base64Data = this.arrayBufferToBase64(imageData);
                            }
                        }
                    } catch (error) {
                        console.log("方法1失败，尝试方法2:", error.message);
                    }
                    
                    if (!base64Data) {
                        try {
                            // 方法2: 使用文档导出API（导出选中图层）
                            const activeDocument = app.activeDocument;
                            
                            // 临时隐藏其他图层
                            const originalStates = await this.hideOtherLayers(activeDocument, layer);
                            
                            try {
                                // 导出当前可见内容
                                const exportOptions = {
                                    format: 'png',
                                    bounds: bounds,
                                    quality: 100,
                                    includeAlpha: true
                                };
                                
                                const imageData = await activeDocument.export(exportOptions);
                                if (imageData) {
                                    base64Data = this.arrayBufferToBase64(imageData);
                                }
                            } finally {
                                // 恢复其他图层的可见性
                                await this.restoreLayerStates(originalStates);
                            }
                        } catch (error) {
                            console.log("方法2失败，尝试方法3:", error.message);
                        }
                    }
                    
                    if (!base64Data) {
                        try {
                            // 方法3: 使用简化的脚本执行方式
                            const script = `
                                (function() {
                                    try {
                                        var layer = app.activeDocument.activeLayer;
                                        
                                        // 简化版本：只返回图层基本信息，不执行复杂的导出操作
                                        if (layer && layer.bounds) {
                                            var bounds = layer.bounds;
                                            var width = bounds[2] - bounds[0];
                                            var height = bounds[3] - bounds[1];
                                            
                                            if (width > 0 && height > 0) {
                                                return "layer_exists";
                                            }
                                        }
                                        
                                        return null;
                                    } catch (e) {
                                        return null;
                                    }
                                })();
                            `;
                            
                            const result = await core.executeAsModal(script, {
                                commandName: "Export Layer"
                            });
                            
                            if (result) {
                                base64Data = result;
                            }
                        } catch (error) {
                            console.log("方法3失败:", error.message);
                        }
                    }
                    
                    if (base64Data) {
                        return `data:image/png;base64,${base64Data}`;
                    } else {
                        throw new Error("所有导出方法都失败了");
                    }
                    
                } catch (error) {
                    console.error("导出图层base64失败:", error);
                    throw error;
                }
            },

            async hideOtherLayers(document, targetLayer) {
                try {
                    const originalStates = [];
                    
                    // 遍历所有图层并记录原始状态
                    for (let i = 0; i < document.layers.length; i++) {
                        const layer = document.layers[i];
                        originalStates.push({
                            layer: layer,
                            visible: layer.visible
                        });
                        
                        // 隐藏非目标图层
                        if (layer.id !== targetLayer.id) {
                            layer.visible = false;
                        }
                    }
                    
                    return originalStates;
                } catch (error) {
                    console.error("隐藏其他图层失败:", error);
                    return [];
                }
            },

            async restoreLayerStates(originalStates) {
                try {
                    for (const state of originalStates) {
                        state.layer.visible = state.visible;
                    }
                } catch (error) {
                    console.error("恢复图层状态失败:", error);
                }
            },
            
            // ==================== 子图层处理方法 ====================

            
            async getChildrenLayers(layer) {
                try {
                    const children = [];
                    
                    // 检查是否是图层组
                    if (layer.typename === 'LayerSet' || layer.kind === 'group') {
                        // 遍历子图层
                        if (layer.layers && layer.layers.length > 0) {
                            for (let i = 0; i < layer.layers.length; i++) {
                                const childLayer = layer.layers[i];
                                const childInfo = await this.getDetailedChildLayerInfo(childLayer);
                                children.push(childInfo);
                            }
                        }
                        
                        // 尝试其他方式获取子图层（不同PS版本可能有不同API）
                        try {
                            if (layer.artLayers) {
                                for (let i = 0; i < layer.artLayers.length; i++) {
                                    const childLayer = layer.artLayers[i];
                                    const childInfo = await this.getDetailedChildLayerInfo(childLayer);
                                    children.push(childInfo);
                                }
                            }
                            
                            if (layer.layerSets) {
                                for (let i = 0; i < layer.layerSets.length; i++) {
                                    const childGroup = layer.layerSets[i];
                                    const childInfo = await this.getDetailedChildLayerInfo(childGroup);
                                    children.push(childInfo);
                                }
                            }
                        } catch (e) {
                            console.log("使用备用方法获取子图层:", e.message);
                        }
                    }
                    
                    return children.length > 0 ? children : null;
                } catch (error) {
                    console.error("获取子图层失败:", error);
                    return null;
                }
            },

            async getDetailedChildLayerInfo(childLayer) {
                try {
                    const childInfo = {
                        // 基本信息
                        name: childLayer.name,
                        type: childLayer.kind || childLayer.typename || 'unknown',
                        id: childLayer.id,
                        visible: childLayer.visible,
                        opacity: childLayer.opacity,
                        
                        // 尺寸和位置
                        bounds: this.getLayerBounds(childLayer),
                        dimensions: this.getLayerDimensions(childLayer),
                        
                        // 样式信息（包含颜色）
                        styles: await this.getLayerStyles(childLayer),
                        
                        // 文本信息（确保文字图层有文案）
                        textInfo: await this.getTextInfo(childLayer),
                        
                        // 形状信息（包含颜色）
                        shapeInfo: await this.getShapeInfo(childLayer),
                        
                        // 图片信息
                        imageInfo: await this.getImageInfo(childLayer),
                        
                        // 递归获取子图层（如果这个子图层也是组）
                        children: await this.getChildrenLayers(childLayer),
                        
                        // CSS属性
                        cssProperties: this.generateCSSProperties(childLayer)
                    };
                    
                    // 为子图层添加汇总颜色信息
                    childInfo.colorSummary = this.getLayerColorSummary(childInfo);
                    
                    return childInfo;
                } catch (error) {
                    console.error("获取子图层详细信息失败:", error);
                    return {
                        name: childLayer.name,
                        type: childLayer.kind || 'unknown',
                        id: childLayer.id,
                        error: error.message
                    };
                }
            },
            
            // ==================== CSS相关工具方法 ====================
            generateCSSProperties(layer) {
                try {
                    const bounds = this.getLayerBounds(layer);
                    const css = {};
                    
                    if (bounds) {
                        css.position = 'absolute';
                        css.left = `${bounds.left}px`;
                        css.top = `${bounds.top}px`;
                        css.width = `${bounds.width}px`;
                        css.height = `${bounds.height}px`;
                    }
                    
                    css.opacity = (layer.opacity || 100) / 100;
                    css.visibility = layer.visible ? 'visible' : 'hidden';
                    
                    if (layer.blendMode) {
                        css.mixBlendMode = this.convertBlendMode(layer.blendMode);
                    }
                    
                    if (layer.rotation) {
                        css.transform = `rotate(${layer.rotation}deg)`;
                    }
                    
                    return css;
                } catch (error) {
                    console.error("生成CSS属性失败:", error);
                    return {};
                }
            },

            convertBlendMode(psBlendMode) {
                const blendModeMap = {
                    'normal': 'normal',
                    'multiply': 'multiply',
                    'screen': 'screen',
                    'overlay': 'overlay',
                    'softLight': 'soft-light',
                    'hardLight': 'hard-light',
                    'colorDodge': 'color-dodge',
                    'colorBurn': 'color-burn',
                    'darken': 'darken',
                    'lighten': 'lighten',
                    'difference': 'difference',
                    'exclusion': 'exclusion'
                };
                return blendModeMap[psBlendMode] || 'normal';
            },
            
            // ==================== 通用工具方法 ====================
            
            arrayBufferToBase64(buffer) {
                try {
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    const len = bytes.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return btoa(binary);
                } catch (error) {
                    console.error("转换ArrayBuffer到Base64失败:", error);
                    return null;
                }
            },

            
            rgbToHex(r, g, b) {
                return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
            }
        },
        
        data() {
            return {
                currentLayerName: '',
                layerType: '',
                layerDimensions: null,
                textContent: '',
                fontSize: null,
                textColor: '',
                fontFamily: '',
                fillColor: '',
                strokeColor: '',
                isImageLayer: false,
                isSmartObject: false,
                hasBase64Data: false,
                base64Size: 0,
                childrenCount: 0,
                layerPath: '',
                nodeId: '',
                status: '初始化中...'
            }
        },
        
        async beforeDestroy() {
            // 清理事件监听器
            try {
                await core.eventManager.detachEventListener("select", this.onLayerSelectionChange);
            } catch (error) {
                console.error("清理监听器失败:", error);
            }
        }
    }
</script>
