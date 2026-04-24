# feat(docker): add sandbox browser service and documentation by dangphdh · Pull Request #11553 · openclaw/openclaw

> 原文链接: https://github.com/openclaw/openclaw/pull/11553/changes

---
[Open in github.dev](https://github.dev/) [Open in a new github.dev tab](https://github.dev/) [Open in codespace](/codespaces/new/openclaw/openclaw/pull/11553?resume=1)

## Pull Request Toolbar

Expand file treeCollapse file tree

Closed

All commits

feat(docker): add sandbox browser service and documentation#11553

All commits

[dangphdh](/dangphdh) wants to merge 1 commit into[openclaw:main](/openclaw/openclaw/tree/main)openclaw/openclaw:mainfrom

[dangphdh:feat/docker-browser-setup](/dangphdh/openclaw/tree/feat/docker-browser-setup)dangphdh/openclaw:feat/docker-browser-setupCopy head branch name to clipboard

0 / 3 viewed

Submit commentsComments

Open diff view settings

Open overview panel

3 (3)Open comments panel

More options

Filter options

## File tree

-   [docker-compose.yml](#diff-e45e45baeda1c1e73482975a664062aa56f20c03dd9d64a827aba57775bed0d3)

    1

-   [DOCKER\_BROWSER\_QUICKSTART.md](#diff-14f5ed6d5c00b1c4e2d6450b7d1ae170bb7aebbd06f398730c3c8af0918ee751)

    1

-   [DOCKER\_BROWSER\_SETUP.md](#diff-587ccdf171eabb7063b4e1567978a6e2866599d3f235995154200d0e800ab894)

    1


Collapse file

### [`‎docker-compose.yml‎`](#diff-e45e45baeda1c1e73482975a664062aa56f20c03dd9d64a827aba57775bed0d3)

Copy file name to clipboardExpand all lines: docker-compose.yml

+12Lines changed: 12 additions & 0 deletions

ViewedComment on this fileMore options

Original file line number

Original file line

Diff line number

Diff line change

`   @@ -11,9 +11,10 @@   `

11

`   volumes:   `

11

`   volumes:   `

12

`   - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw   `

12

`   - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw   `

13

`   - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace   `

13

`   - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace   `

14

`   ports:   `

14

`   ports:   `

15

`   - "${OPENCLAW_GATEWAY_PORT:-18789}:18789"   `

15

`   - "${OPENCLAW_GATEWAY_PORT:-18789}:18789"   `

16

`   - "${OPENCLAW_BRIDGE_PORT:-18790}:18790"   `

16

`   - "${OPENCLAW_BRIDGE_PORT:-18790}:18790"   `

17

`+  - "18792:18792"  `

Collapse comment

## Comment on lines R14 to R17

### greptile-apps\[bot\] commented on Feb 8, 2026

[![@greptile-apps\[bot\]](https://avatars.githubusercontent.com/in/867647?v=4&size=48)](/greptile-apps[bot])

[greptile-apps\[bot\]](/greptile-apps[bot])

[on Feb 8, 2026](https://github.com/openclaw/openclaw/pull/11553/changes#r2778281177)

Contributor

More actions

**Unexpected port exposure**
This PR newly publishes `18792:18792` on `openclaw-gateway` (in addition to the existing gateway/bridge ports). There’s no corresponding env var / documentation for what 18792 is, so `docker compose up` will now expose an extra port by default.

If 18792 is required, consider making it configurable (like the other ports) and documenting what service it corresponds to; otherwise it should be removed to avoid changing the default exposed surface area.

Prompt To Fix With AI

This is a comment left during a code review.
Path: docker-compose.yml
Line: 14:17

Comment:
\*\*Unexpected port exposure\*\*
This PR newly publishes \`18792:18792\` on \`openclaw-gateway\` (in addition to the existing gateway/bridge ports). There’s no corresponding env var / documentation for what 18792 is, so \`docker compose up\` will now expose an extra port by default.

If 18792 is required, consider making it configurable (like the other ports) and documenting what service it corresponds to; otherwise it should be removed to avoid changing the default exposed surface area.

How can I resolve this? If you propose a fix, please make it concise.

React

Write a reply

Resolve comment

17

`   init: true   `

18

`   init: true   `

18

`   restart: unless-stopped   `

19

`   restart: unless-stopped   `

19

`   command:   `

20

`   command:   `

`   @@ -44,3 +45,14 @@   `

44

`   tty: true   `

45

`   tty: true   `

45

`   init: true   `

46

`   init: true   `

46

`   entrypoint: ["node", "dist/index.js"]   `

47

`   entrypoint: ["node", "dist/index.js"]   `

48

`+  `

49

`+  openclaw-browser:  `

50

`+  image: openclaw-sandbox-browser:bookworm-slim  `

51

`+  ports:  `

52

`+  - "${OPENCLAW_BROWSER_CDP_PORT:-9222}:9222"  `

53

`+  - "${OPENCLAW_BROWSER_VNC_PORT:-5900}:5900"  `

54

`+  - "${OPENCLAW_BROWSER_NOVNC_PORT:-6080}:6080"  `

55

`+  environment:  `

56

`+  OPENCLAW_BROWSER_HEADLESS: "${OPENCLAW_BROWSER_HEADLESS:-0}"  `

57

`+  OPENCLAW_BROWSER_ENABLE_NOVNC: "${OPENCLAW_BROWSER_ENABLE_NOVNC:-1}"  `

58

`+  restart: unless-stopped  `

Collapse file

### [`‎DOCKER_BROWSER_QUICKSTART.md‎`](#diff-14f5ed6d5c00b1c4e2d6450b7d1ae170bb7aebbd06f398730c3c8af0918ee751)

Copy file name to clipboard

+110Lines changed: 110 additions & 0 deletions

-   Display the source diff
-   Display the rich diff

ViewedComment on this fileMore options

Original file line number

Original file line

Diff line number

Diff line change

`   @@ -0,0 +1,110 @@   `

1

`+  # Quick Start: Docker Browser for OpenClaw  `

2

`+  `

3

`+  ## TL;DR - Fast Setup  `

4

`+  `

5

`+  ```bash  `

6

`+  # 1. Build the browser image (takes ~5-10 minutes)  `

7

`+  ./scripts/sandbox-browser-setup.sh  `

8

`+  `

9

`+  # 2. Start the browser service  `

10

`+  docker compose up -d openclaw-browser  `

11

`+  `

12

`+  # 3. Configure OpenClaw to use sandbox browser  `

13

`+  docker compose run --rm openclaw-cli config set agents.defaults.sandbox.mode non-main  `

14

`+  docker compose run --rm openclaw-cli config set agents.defaults.sandbox.browser.enabled true  `

15

`+  `

16

`+  # 4. Restart gateway to apply config  `

17

`+  docker compose restart openclaw-gateway  `

18

`+  `

19

`+  # 5. Verify  `

20

`+  docker compose run --rm openclaw-cli browser --browser-profile openclaw status  `

21

`+  ```  `

22

`+  `

Collapse comment

## Comment on line R22

### greptile-apps\[bot\] commented on Feb 8, 2026

[![@greptile-apps\[bot\]](https://avatars.githubusercontent.com/in/867647?v=4&size=48)](/greptile-apps[bot])

[greptile-apps\[bot\]](/greptile-apps[bot])

[on Feb 8, 2026](https://github.com/openclaw/openclaw/pull/11553/changes#r2778281232)

Contributor

More actions

**Wrong profile name**
The quickstart verification step uses `--browser-profile openclaw`, but the docs in this PR define the Docker CDP profile as `docker-browser` (and nothing here defines a profile named `openclaw`). As written, the command will fail unless the user already has a pre-existing `openclaw` profile.

Suggested change

docker compose run --rm openclaw-cli browser --browser-profile docker-browser status

This suggestion cannot be applied because the pull request is closed.

Prompt To Fix With AI

This is a comment left during a code review.
Path: DOCKER\_BROWSER\_QUICKSTART.md
Line: 22:22

Comment:
\*\*Wrong profile name\*\*
The quickstart verification step uses \`\--browser-profile openclaw\`, but the docs in this PR define the Docker CDP profile as \`docker-browser\` (and nothing here defines a profile named \`openclaw\`). As written, the command will fail unless the user already has a pre-existing \`openclaw\` profile.

\`\`\`suggestion
docker compose run --rm openclaw-cli browser --browser-profile docker-browser status
\`\`\`

How can I resolve this? If you propose a fix, please make it concise.

React

Write a reply

Resolve comment

23

`+  ## Access Points  `

24

`+  `

25

`+  - **CDP**: http://localhost:9222  `

26

`+  - **noVNC**: http://localhost:6080/vnc.html  `

27

`+  - **VNC**: localhost:5900  `

28

`+  `

29

`+  ## CLI Quick Commands  `

30

`+  `

31

`+  ```bash  `

32

`+  # Browser status  `

33

`+  docker compose run --rm openclaw-cli browser status  `

34

`+  `

35

`+  # Open URL  `

36

`+  docker compose run --rm openclaw-cli browser open https://example.com  `

37

`+  `

38

`+  # Snapshot  `

39

`+  docker compose run --rm openclaw-cli browser snapshot  `

40

`+  `

41

`+  # Screenshot  `

42

`+  docker compose run --rm openclaw-cli browser screenshot  `

43

`+  `

44

`+  # List tabs  `

45

`+  docker compose run --rm openclaw-cli browser tabs  `

46

`+  ```  `

47

`+  `

48

`+  ## Environment Variables (.env)  `

49

`+  `

50

`+  ```bash  `

51

`+  OPENCLAW_BROWSER_CDP_PORT=9222  `

52

`+  OPENCLAW_BROWSER_VNC_PORT=5900  `

53

`+  OPENCLAW_BROWSER_NOVNC_PORT=6080  `

54

`+  OPENCLAW_BROWSER_HEADLESS=0  `

55

`+  OPENCLAW_BROWSER_ENABLE_NOVNC=1  `

56

`+  ```  `

57

`+  `

58

`+  ## Config Examples  `

59

`+  `

60

`+  ### Sandbox Browser (Recommended)  `

61

`+  `

62

`+  ```json5  `

63

`+  {  `

64

`+  agents: {  `

65

`+  defaults: {  `

66

`+  sandbox: {  `

67

`+  mode: "non-main",  `

68

`+  browser: { enabled: true }  `

69

`+  }  `

70

`+  }  `

71

`+  }  `

72

`+  }  `

73

`+  ```  `

74

`+  `

75

`+  ### Remote Browser  `

76

`+  `

77

`+  ```json5  `

78

`+  {  `

79

`+  browser: {  `

80

`+  enabled: true,  `

81

`+  defaultProfile: "docker-browser",  `

82

`+  profiles: {  `

83

`+  "docker-browser": {  `

84

`+  cdpUrl: "http://openclaw-browser:9222",  `

85

`+  color: "#00AA00"  `

86

`+  }  `

87

`+  }  `

88

`+  }  `

89

`+  }  `

90

`+  ```  `

91

`+  `

92

`+  ## Troubleshooting  `

93

`+  `

94

`+  ```bash  `

95

`+  # Check browser container  `

96

`+  docker compose ps openclaw-browser  `

97

`+  `

98

`+  # View browser logs  `

99

`+  docker compose logs openclaw-browser  `

100

`+  `

101

`+  # Restart browser  `

102

`+  docker compose restart openclaw-browser  `

103

`+  `

104

`+  # Test CDP endpoint  `

105

`+  curl http://localhost:9222/json/version  `

106

`+  ```  `

107

`+  `

108

`+  ## Next Steps  `

109

`+  `

110

``+  See `DOCKER_BROWSER_SETUP.md` for detailed documentation.  ``

Collapse file

### [`‎DOCKER_BROWSER_SETUP.md‎`](#diff-587ccdf171eabb7063b4e1567978a6e2866599d3f235995154200d0e800ab894)

Copy file name to clipboard

+288Lines changed: 288 additions & 0 deletions

-   Display the source diff
-   Display the rich diff

ViewedComment on this fileMore options

Original file line number

Original file line

Diff line number

Diff line change

`   @@ -0,0 +1,288 @@   `

1

`+  # Docker Browser Setup Guide for OpenClaw  `

2

`+  `

3

`+  This guide explains how to set up and use the browser functionality in OpenClaw when running in Docker.  `

4

`+  `

5

`+  ## Overview  `

6

`+  `

7

`+  The setup consists of:  `

8

`+  1. **Sandbox Browser Image** - A dedicated Docker container running Chromium with CDP (Chrome DevTools Protocol) access  `

9

``+  2. **Browser Service** - Added to `docker-compose.yml` for easy management  ``

10

`+  3. **OpenClaw Configuration** - Configure OpenClaw to use the sandbox browser  `

11

`+  `

12

`+  ## Prerequisites  `

13

`+  `

14

`+  - Docker and Docker Compose installed  `

15

``+  - OpenClaw Docker image built (`openclaw:local`)  ``

16

`+  - Sufficient disk space (~2GB for browser image)  `

17

`+  `

18

`+  ## Step 1: Build the Sandbox Browser Image  `

19

`+  `

20

`+  ```bash  `

21

`+  ./scripts/sandbox-browser-setup.sh  `

22

`+  ```  `

23

`+  `

24

``+  This builds the `openclaw-sandbox-browser:bookworm-slim` image with:  ``

25

`+  - Chromium browser  `

26

`+  - Xvfb (X Virtual Framebuffer) for display  `

27

`+  - x11vnc + noVNC for web-based viewing  `

28

`+  - socat for CDP port forwarding  `

29

`+  `

30

`+  ## Step 2: Update docker-compose.yml  `

31

`+  `

32

``+  The `docker-compose.yml` has been updated with a new `openclaw-browser` service:  ``

33

`+  `

34

`+  ```yaml  `

35

`+  openclaw-browser:  `

36

`+  image: openclaw-sandbox-browser:bookworm-slim  `

37

`+  ports:  `

38

`+  - "${OPENCLAW_BROWSER_CDP_PORT:-9222}:9222"  `

39

`+  - "${OPENCLAW_BROWSER_VNC_PORT:-5900}:5900"  `

40

`+  - "${OPENCLAW_BROWSER_NOVNC_PORT:-6080}:6080"  `

41

`+  environment:  `

42

`+  OPENCLAW_BROWSER_HEADLESS: "${OPENCLAW_BROWSER_HEADLESS:-0}"  `

43

`+  OPENCLAW_BROWSER_ENABLE_NOVNC: "${OPENCLAW_BROWSER_ENABLE_NOVNC:-1}"  `

44

`+  restart: unless-stopped  `

45

`+  ```  `

46

`+  `

47

`+  ## Step 3: Configure Environment Variables (Optional)  `

48

`+  `

49

``+  Add to your `.env` file:  ``

50

`+  `

51

`+  ```bash  `

52

`+  # Browser ports  `

53

`+  OPENCLAW_BROWSER_CDP_PORT=9222  `

54

`+  OPENCLAW_BROWSER_VNC_PORT=5900  `

55

`+  OPENCLAW_BROWSER_NOVNC_PORT=6080  `

56

`+  `

57

`+  # Browser mode  `

58

`+  OPENCLAW_BROWSER_HEADLESS=0 # Set to 1 for headless mode  `

59

`+  OPENCLAW_BROWSER_ENABLE_NOVNC=1 # Set to 0 to disable noVNC  `

60

`+  ```  `

61

`+  `

62

`+  ## Step 4: Start the Browser Service  `

63

`+  `

64

`+  ```bash  `

65

`+  # Start all services  `

66

`+  docker compose up -d  `

67

`+  `

68

`+  # Start only the browser  `

69

`+  docker compose up -d openclaw-browser  `

70

`+  ```  `

71

`+  `

72

`+  ## Step 5: Configure OpenClaw to Use the Browser  `

73

`+  `

74

``+  Edit `~/.openclaw/openclaw.json`:  ``

75

`+  `

76

`+  ```json5  `

77

`+  {  `

78

`+  agents: {  `

79

`+  defaults: {  `

80

`+  sandbox: {  `

81

`+  mode: "non-main",  `

82

`+  browser: { enabled: true }  `

83

`+  }  `

84

`+  }  `

85

`+  }  `

86

`+  }  `

87

`+  ```  `

88

`+  `

89

`+  For remote browser (recommended for Docker):  `

90

`+  `

91

`+  ```json5  `

92

`+  {  `

93

`+  browser: {  `

94

`+  enabled: true,  `

95

`+  defaultProfile: "docker-browser",  `

96

`+  profiles: {  `

97

`+  "docker-browser": {  `

98

`+  cdpUrl: "http://openclaw-browser:9222",  `

99

`+  color: "#00AA00"  `

100

`+  }  `

101

`+  }  `

102

`+  }  `

103

`+  }  `

104

`+  ```  `

105

`+  `

106

`+  For sandbox browser mode:  `

107

`+  `

108

`+  ```json5  `

109

`+  {  `

110

`+  agents: {  `

111

`+  defaults: {  `

112

`+  sandbox: {  `

113

`+  mode: "non-main",  `

114

`+  browser: { enabled: true }  `

115

`+  }  `

116

`+  }  `

117

`+  }  `

118

`+  }  `

119

`+  ```  `

120

`+  `

121

`+  ## Step 6: Restart Gateway  `

122

`+  `

123

`+  ```bash  `

124

`+  docker compose restart openclaw-gateway  `

125

`+  ```  `

126

`+  `

127

`+  ## Step 7: Verify Browser Setup  `

128

`+  `

129

`+  ```bash  `

130

`+  # Check browser status via CLI  `

131

`+  docker compose run --rm openclaw-cli browser status  `

132

`+  `

133

`+  # Check if browser container is running  `

134

`+  docker compose ps openclaw-browser  `

135

`+  `

136

`+  # Test browser access  `

137

`+  curl http://localhost:9222/json/version  `

138

`+  ```  `

139

`+  `

140

`+  ## Accessing the Browser  `

141

`+  `

142

`+  ### CDP (Chrome DevTools Protocol)  `

143

``+  - Port: `9222` (default)  ``

144

``+  - URL: `http://localhost:9222`  ``

145

`+  `

146

`+  ### noVNC (Web-based Viewer)  `

147

``+  - Port: `6080` (default)  ``

148

``+  - URL: `http://localhost:6080/vnc.html`  ``

149

`+  `

150

`+  ### VNC  `

151

``+  - Port: `5900` (default)  ``

152

`+  - Use any VNC client  `

153

`+  `

154

`+  ## Usage Examples  `

155

`+  `

156

`+  ### CLI Commands  `

157

`+  `

158

`+  ```bash  `

159

`+  # Open a URL  `

160

`+  docker compose run --rm openclaw-cli browser open https://example.com  `

161

`+  `

162

`+  # Take a snapshot  `

163

`+  docker compose run --rm openclaw-cli browser snapshot  `

164

`+  `

165

`+  # Take a screenshot  `

166

`+  docker compose run --rm openclaw-cli browser screenshot  `

167

`+  `

168

`+  # List tabs  `

169

`+  docker compose run --rm openclaw-cli browser tabs  `

170

`+  ```  `

171

`+  `

172

`+  ### Agent Usage  `

173

`+  `

174

`+  When sandboxing is enabled, agents can automatically use the browser tool:  `

175

`+  `

176

`+  ```  `

177

`+  User: Open https://example.com and take a screenshot  `

178

`+  `

179

`+  Agent: [Uses browser tool to open the URL and capture screenshot]  `

180

`+  ```  `

181

`+  `

182

`+  ## Troubleshooting  `

183

`+  `

184

`+  ### Browser container not starting  `

185

`+  `

186

`+  ```bash  `

187

`+  # Check logs  `

188

`+  docker compose logs openclaw-browser  `

189

`+  `

190

`+  # Rebuild the image  `

191

`+  ./scripts/sandbox-browser-setup.sh  `

192

`+  ```  `

193

`+  `

194

`+  ### Cannot connect to browser  `

195

`+  `

196

``+  1. Verify the container is running: `docker compose ps`  ``

197

``+  2. Check ports: `docker compose port openclaw-browser 9222`  ``

198

``+  3. Test CDP endpoint: `curl http://localhost:9222/json/version`  ``

199

`+  `

200

`+  ### Browser tool disabled  `

201

`+  `

202

``+  1. Enable in config: `agents.defaults.sandbox.browser.enabled = true`  ``

203

``+  2. Restart gateway: `docker compose restart openclaw-gateway`  ``

204

``+  3. Check tool policy: ensure `browser` is not in the deny list  ``

205

`+  `

206

`+  ### noVNC not accessible  `

207

`+  `

208

``+  1. Check if noVNC is enabled: `OPENCLAW_BROWSER_ENABLE_NOVNC=1`  ``

209

``+  2. Verify port mapping: `docker compose port openclaw-browser 6080`  ``

210

``+  3. Check browser is not headless: `OPENCLAW_BROWSER_HEADLESS=0`  ``

211

`+  `

212

`+  ## Advanced Configuration  `

213

`+  `

214

`+  ### Custom Browser Image  `

215

`+  `

216

`+  ```bash  `

217

`+  docker build -t my-openclaw-browser -f Dockerfile.sandbox-browser .  `

218

`+  ```  `

219

`+  `

220

``+  Update `docker-compose.yml`:  ``

221

`+  ```yaml  `

222

`+  openclaw-browser:  `

223

`+  image: my-openclaw-browser  `

224

`+  ```  `

225

`+  `

226

`+  ### Resource Limits  `

227

`+  `

228

`+  ```yaml  `

229

`+  openclaw-browser:  `

230

`+  image: openclaw-sandbox-browser:bookworm-slim  `

231

`+  deploy:  `

232

`+  resources:  `

233

`+  limits:  `

234

`+  cpus: '2'  `

235

`+  memory: 2G  `

236

`+  reservations:  `

237

`+  cpus: '1'  `

238

`+  memory: 1G  `

239

`+  ```  `

240

`+  `

241

`+  ### Headless Mode  `

242

`+  `

243

``+  Set in `.env`:  ``

244

`+  ```bash  `

245

`+  OPENCLAW_BROWSER_HEADLESS=1  `

246

`+  ```  `

247

`+  `

248

`+  This disables Xvfb and noVNC, running Chromium in headless mode only.  `

249

`+  `

250

`+  ## Network Configuration  `

251

`+  `

252

`+  By default, the browser uses the default Docker network. To use a custom network:  `

253

`+  `

254

`+  ```yaml  `

255

`+  openclaw-browser:  `

256

`+  image: openclaw-sandbox-browser:bookworm-slim  `

Collapse comment

## Comment on lines R252 to R256

### greptile-apps\[bot\] commented on Feb 8, 2026

[![@greptile-apps\[bot\]](https://avatars.githubusercontent.com/in/867647?v=4&size=48)](/greptile-apps[bot])

[greptile-apps\[bot\]](/greptile-apps[bot])

[on Feb 8, 2026](https://github.com/openclaw/openclaw/pull/11553/changes#r2778281202)

Contributor

More actions

**Incorrect compose command**
`docker compose down openclaw-browser` isn’t a valid way to stop a single service; `down` tears down the whole project and doesn’t take service names.

Use `docker compose stop openclaw-browser` (or `rm -f` / `up -d --remove-orphans` depending on intent).

Suggested change

By default, the browser uses the default Docker network. To use a custom network:

\`\`\`yaml

openclaw-browser:

image: openclaw-sandbox-browser:bookworm-slim

\# Stop browser service

docker compose stop openclaw-browser

This suggestion cannot be applied because the pull request is closed.

Prompt To Fix With AI

This is a comment left during a code review.
Path: DOCKER\_BROWSER\_SETUP.md
Line: 252:256

Comment:
\*\*Incorrect compose command\*\*
\`docker compose down openclaw-browser\` isn’t a valid way to stop a single service; \`down\` tears down the whole project and doesn’t take service names.

Use \`docker compose stop openclaw-browser\` (or \`rm -f\` / \`up -d --remove-orphans\` depending on intent).

\`\`\`suggestion
\# Stop browser service
docker compose stop openclaw-browser
\`\`\`

How can I resolve this? If you propose a fix, please make it concise.

React

Write a reply

Resolve comment

257

`+  networks:  `

258

`+  - openclaw-net  `

259

`+  `

260

`+  networks:  `

261

`+  openclaw-net:  `

262

`+  external: true  `

263

`+  ```  `

264

`+  `

265

`+  ## Security Notes  `

266

`+  `

267

`+  1. **CDP Port**: The CDP port (9222) is powerful. Keep it private or use a firewall.  `

268

`+  2. **VNC/noVNC**: Consider disabling noVNC if you don't need visual debugging.  `

269

`+  3. **Sandboxing**: The browser container runs as root for Xvfb compatibility. Consider hardening for production.  `

270

`+  `

271

`+  ## Cleanup  `

272

`+  `

273

`+  ```bash  `

274

`+  # Stop browser service  `

275

`+  docker compose down openclaw-browser  `

276

`+  `

277

`+  # Remove browser image  `

278

`+  docker rmi openclaw-sandbox-browser:bookworm-slim  `

279

`+  `

280

`+  # Clean up volumes  `

281

`+  docker volume rm openclaw_home  `

282

`+  ```  `

283

`+  `

284

`+  ## Documentation Links  `

285

`+  `

286

`+  - Docker Setup: https://docs.openclaw.ai/install/docker  `

287

`+  - Browser Tool: https://docs.openclaw.ai/tools/browser  `

288

`+  - Sandboxing: https://docs.openclaw.ai/gateway/sandboxing  `
