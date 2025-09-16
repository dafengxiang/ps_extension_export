<template>
  <form style="padding: 20px;">
    <sp-heading>
      PS Extension Export
    </sp-heading>
    <sp-body> 当前选中图层: {{ currentLayerName || "无" }} </sp-body>
    <sp-body> 图层类型: {{ layerType || "无" }} </sp-body>
    <sp-body v-if="layerDimensions">
      尺寸: {{ layerDimensions.width }}x{{ layerDimensions.height }}px
    </sp-body>
    <sp-body v-if="textContent"> 文本内容: {{ textContent }} </sp-body>
    <sp-body v-if="fontSize"> 字体大小: {{ fontSize }}px </sp-body>
    <sp-body v-if="textColor"> 文本颜色: {{ textColor }} </sp-body>
    <sp-body v-if="fontFamily"> 字体: {{ fontFamily }} </sp-body>
    <sp-body v-if="isImageLayer"> 图片图层: {{ isSmartObject ? "智能对象" : "普通图像" }} </sp-body>
    <sp-body v-if="hasBase64Data"> 图片数据: 已导出base64 ({{ base64Size }}KB) </sp-body>
    <sp-body v-if="childrenCount > 0"> 子图层数量: {{ childrenCount }} </sp-body>
    <sp-body v-if="layerPath"> 图层路径: {{ layerPath }} </sp-body>
    <sp-body v-if="fillColor"> 填充颜色: {{ fillColor }} </sp-body>
    <sp-body v-if="strokeColor"> 描边颜色: {{ strokeColor }} </sp-body>
    <sp-body> 返回的 NodeId: {{ nodeId || "无" }} </sp-body>
    <sp-body> 状态: {{ status }} </sp-body>
    <sp-body style="font-size: 12px; color: #666; margin-top: 10px;">
      已发送详细信息到
      API，包含：位置、尺寸、完整颜色信息（填充/描边/文本颜色）、字体详情、文本内容、效果、子图层、图片信息等
    </sp-body>
    <sp-button @click="getCurrentLayerInfo">发送图层信息</sp-button>
  </form>
</template>

<script>
const { app, core } = require("photoshop");

// 导入工具函数
const {
  // 图层相关
  getLayerBounds,
  getLayerDimensions,
  getLayerTransform,
  getLayerHierarchy,
  getLayerEffects,

  // 颜色相关
  getLayerColors,
  getLayerColorSummary,

  // 文本相关
  getTextInfo,

  // 形状相关
  getShapeInfo,

  // 图片相关
  getImageInfo,

  // CSS相关
  generateCSSProperties,
} = require("./utils");

module.exports = {
  methods: {
    async getCurrentLayerInfo() {
      try {
        const activeDocument = app.activeDocument;
        if (!activeDocument) {
          this.currentLayerName = "无活动文档";
          this.layerType = "";
          this.status = "无活动文档";
          return;
        }

        const activeLayers = activeDocument.activeLayers;
        console.log("activeLayers: ", activeLayers);
        if (activeLayers.length === 0) {
          this.currentLayerName = "未选中图层";
          this.layerType = "";
          this.status = "未选中图层";
          return;
        }

        const activeLayer = activeLayers[0];
        console.log("activeLayer: ", activeLayer);
        this.currentLayerName = activeLayer.name;
        this.layerType = activeLayer.kind || activeLayer.typename || "unknown";

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
      this.textContent = layerInfo.textInfo?.content || "";
      this.fontSize = layerInfo.textInfo?.fontSize;
      this.textColor = layerInfo.textInfo?.color?.hex || "";
      this.fontFamily = layerInfo.textInfo?.fontFamily || "";
      this.isImageLayer = layerInfo.imageInfo?.isImage || false;
      this.isSmartObject = layerInfo.imageInfo?.isSmartObject || false;
      this.hasBase64Data = !!layerInfo.imageInfo?.base64Data;
      this.base64Size = layerInfo.imageInfo?.base64Data
        ? Math.round((layerInfo.imageInfo.base64Data.length * 0.75) / 1024)
        : 0;
      this.childrenCount = layerInfo.children ? layerInfo.children.length : 0;
      this.layerPath = layerInfo.hierarchy?.path || layerInfo.name;

      // 颜色信息
      this.fillColor =
        layerInfo.styles?.colors?.fill?.hex || layerInfo.shapeInfo?.colors?.fill?.hex || "";
      this.strokeColor =
        layerInfo.styles?.colors?.stroke?.hex || layerInfo.shapeInfo?.colors?.stroke?.hex || "";
    },

    async sendLayerInfoToAPI(layerInfo) {
      console.log("layerInfo: ", layerInfo);
      try {
        this.status = "发送中...";

        const response = await fetch("http://127.0.0.1:2271/apis/sendLayerInfo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(layerInfo),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        this.nodeId = result.nodeId || result.id || "未返回nodeId";
        this.status = "发送成功";
      } catch (error) {
        console.error("发送API请求失败:", error);
        this.status = "API调用失败: " + error.message;
        this.nodeId = "";
      }
    },

    async getDetailedLayerInfo(layer, document) {
      try {
        const layerInfo = {
          // 基本信息
          name: layer.name,
          type: layer.kind || layer.typename || "unknown",
          id: layer.id,
          visible: layer.visible,
          opacity: layer.opacity,

          // 尺寸和位置
          bounds: getLayerBounds(layer),
          dimensions: getLayerDimensions(layer),

          // 变换信息
          transform: getLayerTransform(layer),

          // 样式信息
          styles: await this.getLayerStyles(layer),

          // 文本信息（如果是文本图层）
          textInfo: await getTextInfo(layer),

          // 形状信息（如果是形状图层）
          shapeInfo: await getShapeInfo(layer),

          // 图片信息（如果是图像图层）
          imageInfo: await getImageInfo(layer),

          // 子图层信息（如果是图层组）
          children: await this.getChildrenLayers(layer),

          // 层级信息
          hierarchy: getLayerHierarchy(layer),

          // 效果信息
          effects: await getLayerEffects(layer),

          // 文档信息
          documentInfo: {
            width: document.width,
            height: document.height,
            resolution: document.resolution,
            colorMode: document.mode,
          },

          // CSS相关信息
          cssProperties: generateCSSProperties(layer),
        };

        // 添加颜色汇总信息
        layerInfo.colorSummary = getLayerColorSummary(layerInfo);

        return layerInfo;
      } catch (error) {
        console.error("获取详细图层信息失败:", error);
        return {
          name: layer.name,
          type: layer.kind || "unknown",
          id: layer.id,
          error: error.message,
        };
      }
    },

    async getLayerStyles(layer) {
      try {
        const styles = {};

        // 基本样式
        styles.opacity = layer.opacity || 100;
        styles.blendMode = layer.blendMode || "normal";

        // 尝试获取填充颜色
        if (layer.fillOpacity !== undefined) {
          styles.fillOpacity = layer.fillOpacity;
        }

        // 获取图层颜色信息
        styles.colors = await getLayerColors(layer);

        return styles;
      } catch (error) {
        console.error("获取图层样式失败:", error);
        return {};
      }
    },

    async getChildrenLayers(layer) {
      try {
        const children = [];

        // 检查是否是图层组
        if (layer.typename === "LayerSet" || layer.kind === "group") {
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
          type: childLayer.kind || childLayer.typename || "unknown",
          id: childLayer.id,
          visible: childLayer.visible,
          opacity: childLayer.opacity,

          // 尺寸和位置
          bounds: getLayerBounds(childLayer),
          dimensions: getLayerDimensions(childLayer),

          // 样式信息（包含颜色）
          styles: await this.getLayerStyles(childLayer),

          // 文本信息（确保文字图层有文案）
          textInfo: await getTextInfo(childLayer),

          // 形状信息（包含颜色）
          shapeInfo: await getShapeInfo(childLayer),

          // 图片信息
          imageInfo: await getImageInfo(childLayer),

          // 递归获取子图层（如果这个子图层也是组）
          children: await this.getChildrenLayers(childLayer),

          // CSS属性
          cssProperties: generateCSSProperties(childLayer),
        };

        // 为子图层添加汇总颜色信息
        childInfo.colorSummary = getLayerColorSummary(childInfo);

        return childInfo;
      } catch (error) {
        console.error("获取子图层详细信息失败:", error);
        return {
          name: childLayer.name,
          type: childLayer.kind || "unknown",
          id: childLayer.id,
          error: error.message,
        };
      }
    },
  },

  data() {
    return {
      currentLayerName: "",
      layerType: "",
      layerDimensions: null,
      textContent: "",
      fontSize: null,
      textColor: "",
      fontFamily: "",
      fillColor: "",
      strokeColor: "",
      isImageLayer: false,
      isSmartObject: false,
      hasBase64Data: false,
      base64Size: 0,
      childrenCount: 0,
      layerPath: "",
      nodeId: "",
      status: "初始化中...",
    };
  },
};
</script>
