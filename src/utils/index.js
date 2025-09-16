/**
 * Utils模块入口文件
 * 统一导出所有工具函数
 */

// 颜色相关工具
const colorUtils = require('./colorUtils');

// 图层相关工具
const layerUtils = require('./layerUtils');

// 文本相关工具
const textUtils = require('./textUtils');

// 形状相关工具
const shapeUtils = require('./shapeUtils');

// 图片相关工具
const imageUtils = require('./imageUtils');

// 导出相关工具
const exportUtils = require('./exportUtils');

// CSS相关工具
const cssUtils = require('./cssUtils');

module.exports = {
    // 颜色工具
    ...colorUtils,
    
    // 图层工具
    ...layerUtils,
    
    // 文本工具
    ...textUtils,
    
    // 形状工具
    ...shapeUtils,
    
    // 图片工具
    ...imageUtils,
    
    // 导出工具
    ...exportUtils,
    
    // CSS工具
    ...cssUtils
};
