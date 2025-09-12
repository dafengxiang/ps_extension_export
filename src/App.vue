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
        <sp-body>
            返回的 NodeId: {{ nodeId || '无' }}
        </sp-body>
        <sp-body>
            状态: {{ status }}
        </sp-body>
        <sp-body style="font-size: 12px; color: #666; margin-top: 10px;">
            已发送详细信息到 API，包含：位置、尺寸、颜色、字体、效果、子图层、图片信息等
        </sp-body>
        <sp-button v-on:click="refreshLayerInfo">刷新图层信息</sp-button>
    </form>
</template>

<script>
    const { app, core } = require("photoshop");
    
    module.exports = {
        async mounted() {
            // 监听文档和图层选择变化
            await this.startLayerMonitoring();
        },
        methods: {
            async startLayerMonitoring() {
                try {
                    // 监听图层选择变化
                    await core.eventManager.attachEventListener("select", this.onLayerSelectionChange);
                    this.status = "监听已启动";
                    
                    // 初始化获取当前选中图层信息
                    await this.getCurrentLayerInfo();
                } catch (error) {
                    console.error("启动监听失败:", error);
                    this.status = "监听启动失败: " + error.message;
                }
            },
            
            async onLayerSelectionChange() {
                try {
                    await this.getCurrentLayerInfo();
                } catch (error) {
                    console.error("图层选择变化处理失败:", error);
                    this.status = "处理失败: " + error.message;
                }
            },
            
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
                    if (activeLayers.length === 0) {
                        this.currentLayerName = '未选中图层';
                        this.layerType = '';
                        this.status = "未选中图层";
                        return;
                    }
                    
                    const activeLayer = activeLayers[0];
                    this.currentLayerName = activeLayer.name;
                    this.layerType = activeLayer.kind || activeLayer.typename || 'unknown';
                    
                    // 准备发送的详细图层信息
                    const layerInfo = await this.getDetailedLayerInfo(activeLayer, activeDocument);
                    
                    // 更新UI显示的数据
                    this.layerDimensions = layerInfo.dimensions;
                    this.textContent = layerInfo.textInfo?.content || '';
                    this.fontSize = layerInfo.textInfo?.fontSize;
                    this.isImageLayer = layerInfo.imageInfo?.isImage || false;
                    this.isSmartObject = layerInfo.imageInfo?.isSmartObject || false;
                    this.hasBase64Data = !!layerInfo.imageInfo?.base64Data;
                    this.base64Size = layerInfo.imageInfo?.base64Data ? 
                        Math.round(layerInfo.imageInfo.base64Data.length * 0.75 / 1024) : 0;
                    this.childrenCount = layerInfo.children ? layerInfo.children.length : 0;
                    this.layerPath = layerInfo.hierarchy?.path || layerInfo.name;
                    
                    // 发送到API
                    await this.sendLayerInfoToAPI(layerInfo);
                    
                } catch (error) {
                    console.error("获取图层信息失败:", error);
                    this.status = "获取信息失败: " + error.message;
                }
            },
            
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
                    
                    return styles;
                } catch (error) {
                    console.error("获取图层样式失败:", error);
                    return {};
                }
            },

            async getTextInfo(layer) {
                try {
                    if (layer.kind === 'text' || layer.typename === 'ArtLayer') {
                        // 尝试获取文本属性
                        const textInfo = {
                            content: layer.textItem?.contents || '',
                            fontSize: layer.textItem?.size || null,
                            fontFamily: layer.textItem?.font || null,
                            color: this.getTextColor(layer.textItem),
                            justification: layer.textItem?.justification || null,
                            antiAliasMethod: layer.textItem?.antiAliasMethod || null
                        };
                        
                        return textInfo;
                    }
                    return null;
                } catch (error) {
                    console.error("获取文本信息失败:", error);
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

            async getShapeInfo(layer) {
                try {
                    if (layer.kind === 'shape' || layer.typename === 'ArtLayer') {
                        return {
                            shapeType: layer.shapeOperation || 'unknown',
                            strokeEnabled: layer.strokeEnabled || false,
                            fillEnabled: layer.fillEnabled || false
                        };
                    }
                    return null;
                } catch (error) {
                    console.error("获取形状信息失败:", error);
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
                            // 方法3: 使用脚本执行方式
                            const script = `
                                try {
                                    var layer = app.activeDocument.activeLayer;
                                    var bounds = layer.bounds;
                                    var width = bounds[2] - bounds[0];
                                    var height = bounds[3] - bounds[1];
                                    
                                    if (width > 0 && height > 0) {
                                        // 复制图层内容
                                        layer.copy();
                                        
                                        // 创建新文档
                                        var newDoc = app.documents.add(width, height, 72, "temp", NewDocumentMode.RGB);
                                        
                                        // 粘贴内容
                                        newDoc.paste();
                                        
                                        // 导出为PNG
                                        var file = new File(Folder.temp + "/temp_layer.png");
                                        var pngOptions = new PNGSaveOptions();
                                        pngOptions.compression = 6;
                                        pngOptions.interlaced = false;
                                        
                                        newDoc.exportDocument(file, ExportType.SAVEFORWEB, pngOptions);
                                        newDoc.close(SaveOptions.DONOTSAVECHANGES);
                                        
                                        // 读取文件并转换为base64
                                        var fileContent = file.read("binary");
                                        var base64 = btoa(fileContent);
                                        file.remove();
                                        
                                        base64;
                                    } else {
                                        null;
                                    }
                                } catch (e) {
                                    null;
                                }
                            `;
                            
                            const result = await core.executeAsModal(async () => {
                                return await app.activeDocument.suspendHistory('Export Layer', script);
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
                    return {
                        // 基本信息
                        name: childLayer.name,
                        type: childLayer.kind || childLayer.typename || 'unknown',
                        id: childLayer.id,
                        visible: childLayer.visible,
                        opacity: childLayer.opacity,
                        
                        // 尺寸和位置
                        bounds: this.getLayerBounds(childLayer),
                        dimensions: this.getLayerDimensions(childLayer),
                        
                        // 样式信息
                        styles: await this.getLayerStyles(childLayer),
                        
                        // 文本信息
                        textInfo: await this.getTextInfo(childLayer),
                        
                        // 形状信息
                        shapeInfo: await this.getShapeInfo(childLayer),
                        
                        // 图片信息
                        imageInfo: await this.getImageInfo(childLayer),
                        
                        // 递归获取子图层（如果这个子图层也是组）
                        children: await this.getChildrenLayers(childLayer),
                        
                        // CSS属性
                        cssProperties: this.generateCSSProperties(childLayer)
                    };
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

            rgbToHex(r, g, b) {
                return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
            },
            
            async sendLayerInfoToAPI(layerInfo) {
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
            
            async refreshLayerInfo() {
                await this.getCurrentLayerInfo();
            }
        },
        data() {
            return {
                currentLayerName: '',
                layerType: '',
                layerDimensions: null,
                textContent: '',
                fontSize: null,
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
