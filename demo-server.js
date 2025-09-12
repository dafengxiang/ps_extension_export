const http = require('http');
const url = require('url');

const port = 2271;

const server = http.createServer((req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // 处理OPTIONS预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  
  // 检查是否是目标API路径
  if (req.method === 'POST' && parsedUrl.pathname === '/apis/sendLayerInfo') {
    let body = '';
    
    // 收集请求数据
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // 解析JSON数据
        const data = JSON.parse(body);
        console.log('收到数据:', data);
        
        // 生成随机nodeId
        const nodeId = Math.floor(Math.random() * 1000000);
        
        // 返回响应
        const response = {
          success: true,
          nodeId: nodeId,
          message: '数据接收成功'
        };
        
        res.writeHead(200);
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('解析数据错误:', error);
        res.writeHead(400);
        res.end(JSON.stringify({ error: '无效的JSON数据' }));
      }
    });
  } else {
    // 404 处理
    res.writeHead(404);
    res.end(JSON.stringify({ error: '接口未找到' }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`服务器运行在 http://127.0.0.1:${port}`);
  console.log(`API接口: http://127.0.0.1:${port}/apis/sendLayerInfo`);
});