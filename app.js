const express = require("express");
const axios = require("axios");

const app = express();
// 解析json请求体
app.use(express.json());
const cors = require("cors");
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
const PORT = 12400;

// 用于保存最新的 tenantaccesstoken
let tenantAccessToken = null;

// 定时任务函数
async function fetchTenantAccessToken() {
  try {
    // 模拟拉取 token 的 API 地址
    const TOKEN_API_URL =
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
    const response = await axios.post(TOKEN_API_URL, {
      app_id: "cli_a808d4cd6879d00d",
      app_secret: "WbTsqUyTa02fuUHWY0Kozd4HtmVxCaTq",
    });
    tenantAccessToken = response.data.tenant_access_token;
    console.log("已更新 tenantaccesstoken:", tenantAccessToken);
  } catch (error) {
    console.error("拉取 tenantaccesstoken 失败:", error.message);
  }
}

// 启动时立即拉取一次
fetchTenantAccessToken();
// 每1.5小时（5400000毫秒）拉取一次
setInterval(fetchTenantAccessToken, 1.5 * 60 * 60 * 1000);

// 添加axios请求拦截器，在每次请求前加上tenantAccessToken
axios.interceptors.request.use(
  (config) => {
    if (tenantAccessToken) {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${tenantAccessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const appToken = "Uy8ebKkX5abEKMscka6cvc1mnkf";
const tableId = "tblyB6Yw9V077qsA";

const BASE_URL = "https://open.feishu.cn/open-apis/bitable/v1";

app.get("/api/letters", async (req, res) => {
  try {
    const response = await axios.post(
      BASE_URL +
        `/apps/${appToken}/tables/${tableId}/records/search?page_size=500`,
      {
        filter: {
          conjunction: "or",
          conditions: [
            {
              field_name: "来信审核状态",
              operator: "is",
              value: ["审核通过"],
            },
          ],
        },
      }
    );
    res.json(response.data.data.items);
  } catch (error) {
    res.status(500).json({ error: "无法获取外部数据", detail: error.message });
  }
});

// 下载图片并返回的接口（从query参数获取url）
app.get("/api/image", async (req, res) => {
  try {
    // 从查询参数获取url
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ error: "缺少url参数" });
    }
    // 请求图片，responseType设为stream
    const response = await axios.get(imageUrl, { responseType: "stream" });
    // 设置响应头
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "image/jpeg"
    );
    // 管道输出图片内容
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ error: "图片下载失败", detail: error.message });
  }
});

let recordId;

app.get("/api/getMessage", async (req, res) => {
  try {
    const response = await axios.post(
      BASE_URL +
        `/apps/${appToken}/tables/${tableId}/records/search?page_size=1`,
      {
        field_names: ["来信内容", "日出地点"],
        filter: {
          conjunction: "and",
          conditions: [
            {
              field_name: "来信审核状态",
              operator: "is",
              value: ["审核通过"],
            },
            {
              field_name: "硬件端回信",
              operator: "isEmpty",
              value: [],
            },
          ],
        },
      }
    );
    const record = response.data.data.items[0];
    recordId = record.record_id;
    console.log(recordId);
    res.json({
      message: record.fields["来信内容"][0].text,
      location: record.fields["日出地点"].cityname
    });
  } catch (error) {
    res.status(500).json({ error: "无法获取外部数据", detail: error.message });
  }
});

app.post("/api/postMessage", async (req, res) => {
  try {
    const response = await axios.put(
      BASE_URL + `/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      {
        fields: {
          硬件端回信: req.body.message,
        },
      }
    );
    console.log(response.data);
    res.json("success");
  } catch (error) {
    res.status(500).json({ error: "无法推送外部数据", detail: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
});
