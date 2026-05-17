---
created: 2026-05-15
updated: 2026-05-17
synthesis_updated_at: 2026-05-17
type: entity
refs: 8
tier: active
---

# Li Auto

Chinese EV and smart-car maker; develops MindGPT in-car AI assistant (理想汽车)

## Synthesis



Li Auto (理想汽车) is the Chinese EV manufacturer whose VLA program has emerged as one of the most public production AV stacks in the corpus. At ICCV 2025 the VLA lead (詹锟) reported MPI exceeded 220+ (a 19× improvement since July 2024) on 1.5 billion km of driving data, framing the next phase as transition from data closed-loop (insufficient for long-tail events like traffic control, fireworks, sudden lane changes) to training closed-loop via VLA+RL+World Model using scene reconstruction (Feedforward 3DGS), synthetic data generation, and RL with SimAgents. MindVLA-o1 at GTC 2026 adds a 3D ViT encoder (self-supervised next-frame prediction joining geometry, semantics, and motion), a predictive latent world model, parallel trajectory decoding with diffusion optimization for smooth action output, an MoE parallel action decoder for efficient inference, and RL with world-model rollouts — framed as addressing "mainstream VLA paradigm limitations." MindGPT-4o-Audio launched as a full-duplex low-latency end-to-end voice model: 260 ms understanding+generation inference latency, 800 ms full-link peak, 96.5% turn-switch accuracy, 99% interruption response, and ~1100 ms E2E (beating Doubao at 2100 ms and GPT-4o at 1900 ms), deployed across in-car infotainment and the mobile app. The mobile assistant adopts a hybrid Agent architecture combining MCP (API Agent) for millisecond-latency vehicle hardware control and CUA (GUI Agent) operating third-party apps via screenshot + multimodal recognition + coordinate click, with 72.7% ScreenSpot capability (Gemini 3 Pro baseline) — a representative deployment of the mixed-Agent paradigm.



## Observations

- 理想同学采用MCP（API Agent）+CUA（GUI Agent）混合架构：MCP负责车辆硬件控制（毫秒级响应），CUA通过截屏+多模态识别+坐标点击操控第三方App（如星巴克点咖啡），ScreenSpot能力72.7%（基于Gemini 3 pro基准），是典型混合Agent落地范式。 — [[2026-01-14-ai交互的革命-从操作现有软件-到生成未来软件]]
- 发布MindGPT-4o-Audio全双工低延迟语音端到端模型：理解+生成推理延迟260ms，全链路峰值800ms；对话轮次切换准确率96.5%，打断响应率99%；端到端延迟约1100ms，优于豆包（2100ms）和GPT-4o（1900ms）；已在理想车机和手机App全量上线。 — [[2026-01-14-理想同学mindgpt-4o-audio实时语音对话大模型发布]]
- Li Auto VLA lead 詹锟 at ICCV'25: MPI exceeded 220+ (19× improvement since July 2024); 1.5 billion km driving data; data closed-loop alone cannot solve long-tail events (traffic control, fireworks, sudden lane changes); the next phase is training closed-loop via VLA+RL+World Model — scene reconstruction (Feedforward 3DGS), synthetic data generation, and RL with SimAgents. — [[2025-12-05-理想iccv-25分享了世界模型-从数据闭环到训练闭环]]
- Listed in the 2025 自动驾驶之心 community as one of ~30 head domestic and international AV/smart-car companies represented among its 4000+ members, alongside Waymo equivalent and Chinese OEM tiers (NIO, Xpeng, Horizon Robotics, Huawei, DJI, SAIC, Bosch, Momenta, Baidu). — [[2025-08-15-汇总了自动驾驶几乎所有的技术栈]]
