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
        <sp-body>
            返回的 NodeId: {{ nodeId || '无' }}
        </sp-body>
        <sp-body>
            状态: {{ status }}
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
                    
                    // 准备发送的图层信息
                    const layerInfo = {
                        name: activeLayer.name,
                        type: this.layerType,
                        id: activeLayer.id,
                        visible: activeLayer.visible,
                        opacity: activeLayer.opacity,
                        bounds: this.getLayerBounds(activeLayer)
                    };
                    
                    // 发送到API
                    await this.sendLayerInfoToAPI(layerInfo);
                    
                } catch (error) {
                    console.error("获取图层信息失败:", error);
                    this.status = "获取信息失败: " + error.message;
                }
            },
            
            getLayerBounds(layer) {
                try {
                    if (layer.bounds) {
                        return {
                            left: layer.bounds.left,
                            top: layer.bounds.top,
                            right: layer.bounds.right,
                            bottom: layer.bounds.bottom
                        };
                    }
                    return null;
                } catch (error) {
                    console.error("获取图层边界失败:", error);
                    return null;
                }
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
