# Computer Science > Computation and Language

**arXiv:2509.25149** (cs)

\[Submitted on 29 Sep 2025 ([v1](https://arxiv.org/abs/2509.25149v1)), last revised 4 Mar 2026 (this version, v2)\]

# Title:Pretraining Large Language Models with NVFP4

Authors:[NVIDIA](https://arxiv.org/search/cs?searchtype=author&query=NVIDIA), [Felix Abecassis](https://arxiv.org/search/cs?searchtype=author&query=Abecassis,+F), [Anjulie Agrusa](https://arxiv.org/search/cs?searchtype=author&query=Agrusa,+A), [Dong Ahn](https://arxiv.org/search/cs?searchtype=author&query=Ahn,+D), [Jonah Alben](https://arxiv.org/search/cs?searchtype=author&query=Alben,+J), [Stefania Alborghetti](https://arxiv.org/search/cs?searchtype=author&query=Alborghetti,+S), [Michael Andersch](https://arxiv.org/search/cs?searchtype=author&query=Andersch,+M), [Sivakumar Arayandi](https://arxiv.org/search/cs?searchtype=author&query=Arayandi,+S), [Alexis Bjorlin](https://arxiv.org/search/cs?searchtype=author&query=Bjorlin,+A), [Aaron Blakeman](https://arxiv.org/search/cs?searchtype=author&query=Blakeman,+A), [Evan Briones](https://arxiv.org/search/cs?searchtype=author&query=Briones,+E), [Ian Buck](https://arxiv.org/search/cs?searchtype=author&query=Buck,+I), [Bryan Catanzaro](https://arxiv.org/search/cs?searchtype=author&query=Catanzaro,+B), [Muya Chang](https://arxiv.org/search/cs?searchtype=author&query=Chang,+M), [Jinhang Choi](https://arxiv.org/search/cs?searchtype=author&query=Choi,+J), [Mike Chrzanowski](https://arxiv.org/search/cs?searchtype=author&query=Chrzanowski,+M), [Eric Chung](https://arxiv.org/search/cs?searchtype=author&query=Chung,+E), [Victor Cui](https://arxiv.org/search/cs?searchtype=author&query=Cui,+V), [Steve Dai](https://arxiv.org/search/cs?searchtype=author&query=Dai,+S), [Bita Darvish Rouhani](https://arxiv.org/search/cs?searchtype=author&query=Rouhani,+B+D), [Carlo del Mundo](https://arxiv.org/search/cs?searchtype=author&query=del+Mundo,+C), [Deena Donia](https://arxiv.org/search/cs?searchtype=author&query=Donia,+D), [Burc Eryilmaz](https://arxiv.org/search/cs?searchtype=author&query=Eryilmaz,+B), [Henry Estela](https://arxiv.org/search/cs?searchtype=author&query=Estela,+H), [Abhinav Goel](https://arxiv.org/search/cs?searchtype=author&query=Goel,+A), [Oleg Goncharov](https://arxiv.org/search/cs?searchtype=author&query=Goncharov,+O), [Yugi Guvvala](https://arxiv.org/search/cs?searchtype=author&query=Guvvala,+Y), [Robert Hesse](https://arxiv.org/search/cs?searchtype=author&query=Hesse,+R), [Russell Hewett](https://arxiv.org/search/cs?searchtype=author&query=Hewett,+R), [Herbert Hum](https://arxiv.org/search/cs?searchtype=author&query=Hum,+H), [Ujval Kapasi](https://arxiv.org/search/cs?searchtype=author&query=Kapasi,+U), [Brucek Khailany](https://arxiv.org/search/cs?searchtype=author&query=Khailany,+B), [Mikail Khona](https://arxiv.org/search/cs?searchtype=author&query=Khona,+M), [Nick Knight](https://arxiv.org/search/cs?searchtype=author&query=Knight,+N), [Alex Kondratenko](https://arxiv.org/search/cs?searchtype=author&query=Kondratenko,+A), [Ronny Krashinsky](https://arxiv.org/search/cs?searchtype=author&query=Krashinsky,+R), [Ben Lanir](https://arxiv.org/search/cs?searchtype=author&query=Lanir,+B), [Simon Layton](https://arxiv.org/search/cs?searchtype=author&query=Layton,+S), [Michael Lightstone](https://arxiv.org/search/cs?searchtype=author&query=Lightstone,+M), [Daniel Lo](https://arxiv.org/search/cs?searchtype=author&query=Lo,+D), [Paulius Micikevicius](https://arxiv.org/search/cs?searchtype=author&query=Micikevicius,+P), [Asit Mishra](https://arxiv.org/search/cs?searchtype=author&query=Mishra,+A), [Tim Moon](https://arxiv.org/search/cs?searchtype=author&query=Moon,+T), [Deepak Narayanan](https://arxiv.org/search/cs?searchtype=author&query=Narayanan,+D), [Chao Ni](https://arxiv.org/search/cs?searchtype=author&query=Ni,+C), [Abhijit Paithankar](https://arxiv.org/search/cs?searchtype=author&query=Paithankar,+A), [Satish Pasumarthi](https://arxiv.org/search/cs?searchtype=author&query=Pasumarthi,+S), [Ankit Patel](https://arxiv.org/search/cs?searchtype=author&query=Patel,+A), [Mostofa Patwary](https://arxiv.org/search/cs?searchtype=author&query=Patwary,+M), [Ashwin Poojary](https://arxiv.org/search/cs?searchtype=author&query=Poojary,+A), [Gargi Prasad](https://arxiv.org/search/cs?searchtype=author&query=Prasad,+G), [Sweta Priyadarshi](https://arxiv.org/search/cs?searchtype=author&query=Priyadarshi,+S), [Yigong Qin](https://arxiv.org/search/cs?searchtype=author&query=Qin,+Y), [Xiaowei Ren](https://arxiv.org/search/cs?searchtype=author&query=Ren,+X), [Oleg Rybakov](https://arxiv.org/search/cs?searchtype=author&query=Rybakov,+O), [Charbel Sakr](https://arxiv.org/search/cs?searchtype=author&query=Sakr,+C), [Sanjeev Satheesh](https://arxiv.org/search/cs?searchtype=author&query=Satheesh,+S), [Stas Sergienko](https://arxiv.org/search/cs?searchtype=author&query=Sergienko,+S), [Pasha Shamis](https://arxiv.org/search/cs?searchtype=author&query=Shamis,+P), [Kirthi Shankar](https://arxiv.org/search/cs?searchtype=author&query=Shankar,+K), [Nishant Sharma](https://arxiv.org/search/cs?searchtype=author&query=Sharma,+N), [Mohammad Shoeybi](https://arxiv.org/search/cs?searchtype=author&query=Shoeybi,+M), [Michael Siu](https://arxiv.org/search/cs?searchtype=author&query=Siu,+M), [Misha Smelyanskiy](https://arxiv.org/search/cs?searchtype=author&query=Smelyanskiy,+M), [Darko Stosic](https://arxiv.org/search/cs?searchtype=author&query=Stosic,+D), [Dusan Stosic](https://arxiv.org/search/cs?searchtype=author&query=Stosic,+D), [Bor-Yiing Su](https://arxiv.org/search/cs?searchtype=author&query=Su,+B), [Frank Sun](https://arxiv.org/search/cs?searchtype=author&query=Sun,+F), [Nima Tajbakhsh](https://arxiv.org/search/cs?searchtype=author&query=Tajbakhsh,+N), [Shelby Thomas](https://arxiv.org/search/cs?searchtype=author&query=Thomas,+S), [Przemek Tredak](https://arxiv.org/search/cs?searchtype=author&query=Tredak,+P), [Evgeny Tsykunov](https://arxiv.org/search/cs?searchtype=author&query=Tsykunov,+E), [Gandhi Vaithilingam](https://arxiv.org/search/cs?searchtype=author&query=Vaithilingam,+G), [Aditya Vavre](https://arxiv.org/search/cs?searchtype=author&query=Vavre,+A), [Rangharajan Venkatesan](https://arxiv.org/search/cs?searchtype=author&query=Venkatesan,+R), [Roger Waleffe](https://arxiv.org/search/cs?searchtype=author&query=Waleffe,+R), [Qiyu Wan](https://arxiv.org/search/cs?searchtype=author&query=Wan,+Q), [Hexin Wang](https://arxiv.org/search/cs?searchtype=author&query=Wang,+H), [Mengdi Wang](https://arxiv.org/search/cs?searchtype=author&query=Wang,+M), [Lizzie Wei](https://arxiv.org/search/cs?searchtype=author&query=Wei,+L), [Hao Wu](https://arxiv.org/search/cs?searchtype=author&query=Wu,+H), [Evan Wu](https://arxiv.org/search/cs?searchtype=author&query=Wu,+E), [Keith Wyss](https://arxiv.org/search/cs?searchtype=author&query=Wyss,+K), [Ning Xu](https://arxiv.org/search/cs?searchtype=author&query=Xu,+N), [Jinze Xue](https://arxiv.org/search/cs?searchtype=author&query=Xue,+J), [Charlene Yang](https://arxiv.org/search/cs?searchtype=author&query=Yang,+C), [Yujia Zhai](https://arxiv.org/search/cs?searchtype=author&query=Zhai,+Y), [Ruoxi Zhang](https://arxiv.org/search/cs?searchtype=author&query=Zhang,+R), [Jingyang Zhu](https://arxiv.org/search/cs?searchtype=author&query=Zhu,+J), [Zhongbo Zhu](https://arxiv.org/search/cs?searchtype=author&query=Zhu,+Z)

View a PDF of the paper titled Pretraining Large Language Models with NVFP4, by NVIDIA and 89 other authors

[View PDF](/pdf/2509.25149) [HTML (experimental)](https://arxiv.org/html/2509.25149v2)

> Abstract:Large Language Models (LLMs) today are powerful problem solvers across many domains, and they continue to get stronger as they scale in model size, training set size, and training set quality, as shown by extensive research and experimentation across the industry. Training a frontier model today requires on the order of tens to hundreds of yottaflops, which is a massive investment of time, compute, and energy. Improving pretraining efficiency is therefore essential to enable the next generation of even more capable LLMs. While 8-bit floating point (FP8) training is now widely adopted, transitioning to even narrower precision, such as 4-bit floating point (FP4), could unlock additional improvements in computational speed and resource utilization. However, quantization at this level poses challenges to training stability, convergence, and implementation, notably for large-scale models trained on long token horizons.
> In this study, we introduce a novel approach for stable and accurate training of large language models (LLMs) using the NVFP4 format. Our method integrates Random Hadamard transforms (RHT) to bound block-level outliers, employs a two-dimensional quantization scheme for consistent representations across both the forward and backward passes, utilizes stochastic rounding for unbiased gradient estimation, and incorporates selective high-precision layers. We validate our approach by training a 12-billion-parameter model on 10 trillion tokens -- the longest publicly documented training run in 4-bit precision to date. Our results show that the model trained with our NVFP4-based pretraining technique achieves training loss and downstream task accuracies comparable to an FP8 baseline. These findings highlight that NVFP4, when combined with our training approach, represents a major step forward in narrow-precision LLM training algorithms.

|     |     |
| --- | --- |
| Comments: | Update includes: (1) fixing a typo in eq. 2 (2) updating author list, and (3) adding a related work |
| Subjects: | Computation and Language (cs.CL); Artificial Intelligence (cs.AI); Machine Learning (cs.LG) |
| Cite as: | [arXiv:2509.25149](https://arxiv.org/abs/2509.25149) \[cs.CL\] |
|     | (or [arXiv:2509.25149v2](https://arxiv.org/abs/2509.25149v2) \[cs.CL\] for this version) |
|     | [https://doi.org/10.48550/arXiv.2509.25149](https://doi.org/10.48550/arXiv.2509.25149) arXiv-issued DOI via DataCite |

## Submission history

From: Asit Mishra \[[view email](/show-email/45ac2397/2509.25149)\]
**[\[v1\]](/abs/2509.25149v1)** Mon, 29 Sep 2025 17:53:17 UTC (2,214 KB)
**\[v2\]** Wed, 4 Mar 2026 23:43:57 UTC (2,214 KB)

Full-text links:

## Access Paper:

View a PDF of the paper titled Pretraining Large Language Models with NVFP4, by NVIDIA and 89 other authors

-   [View PDF](/pdf/2509.25149)
-   [HTML (experimental)](https://arxiv.org/html/2509.25149v2)
-   [TeX Source](/src/2509.25149)

 [![license icon](arxiv-org-img-001.png) view license](http://creativecommons.org/licenses/by/4.0/ "Rights to this article")

Current browse context:

cs.CL

[< prev](/prevnext?id=2509.25149&function=prev&context=cs.CL "previous in cs.CL (accesskey p)")   |   [next >](/prevnext?id=2509.25149&function=next&context=cs.CL "next in cs.CL (accesskey n)")

[new](/list/cs.CL/new) | [recent](/list/cs.CL/recent) | [2025-09](/list/cs.CL/2025-09)

Change to browse by:

[cs](/abs/2509.25149?context=cs)
[cs.AI](/abs/2509.25149?context=cs.AI)
[cs.LG](/abs/2509.25149?context=cs.LG)

### References & Citations

-   [NASA ADS](https://ui.adsabs.harvard.edu/abs/arXiv:2509.25149)
-   [Google Scholar](https://scholar.google.com/scholar_lookup?arxiv_id=2509.25149)
-   [Semantic Scholar](https://api.semanticscholar.org/arXiv:2509.25149)

export BibTeX citation Loading...

## BibTeX formatted citation

×

loading...

Data provided by:

### Bookmark

 [![BibSonomy logo](arxiv-org-img-002.png)](<http://www.bibsonomy.org/BibtexHandler?requTask=upload&url=https://arxiv.org/abs/2509.25149&description=Pretraining Large Language Models with NVFP4> "Bookmark on BibSonomy")[![Reddit logo](arxiv-org-img-003.png)](<https://reddit.com/submit?url=https://arxiv.org/abs/2509.25149&title=Pretraining Large Language Models with NVFP4> "Bookmark on Reddit")

 Bibliographic Tools

# Bibliographic and Citation Tools

 Bibliographic Explorer Toggle

Bibliographic Explorer *([What is the Explorer?](https://info.arxiv.org/labs/showcase.html#arxiv-bibliographic-explorer))*

 Connected Papers Toggle

Connected Papers *([What is Connected Papers?](https://www.connectedpapers.com/about))*

 Litmaps Toggle

Litmaps *([What is Litmaps?](https://www.litmaps.co/))*

 scite.ai Toggle

scite Smart Citations *([What are Smart Citations?](https://www.scite.ai/))*

 Code, Data, Media

# Code, Data and Media Associated with this Article

 alphaXiv Toggle

alphaXiv *([What is alphaXiv?](https://alphaxiv.org/))*

 Links to Code Toggle

CatalyzeX Code Finder for Papers *([What is CatalyzeX?](https://www.catalyzex.com))*

 DagsHub Toggle

DagsHub *([What is DagsHub?](https://dagshub.com/))*

 GotitPub Toggle

Gotit.pub *([What is GotitPub?](http://gotit.pub/faq))*

 Huggingface Toggle

Hugging Face *([What is Huggingface?](https://huggingface.co/huggingface))*

 Links to Code Toggle

Papers with Code *([What is Papers with Code?](https://paperswithcode.com/))*

 ScienceCast Toggle

ScienceCast *([What is ScienceCast?](https://sciencecast.org/welcome))*

 Demos

# Demos

 Replicate Toggle

Replicate *([What is Replicate?](https://replicate.com/docs/arxiv/about))*

 Spaces Toggle

Hugging Face Spaces *([What is Spaces?](https://huggingface.co/docs/hub/spaces))*

 Spaces Toggle

TXYZ.AI *([What is TXYZ.AI?](https://txyz.ai))*

 Related Papers

# Recommenders and Search Tools

 Link to Influence Flower

Influence Flower *([What are Influence Flowers?](https://influencemap.cmlab.dev/))*

 Core recommender toggle

CORE Recommender *([What is CORE?](https://core.ac.uk/services/recommender))*

-   Author
-   Venue
-   Institution
-   Topic

 About arXivLabs

# arXivLabs: experimental projects with community collaborators

arXivLabs is a framework that allows collaborators to develop and share new arXiv features directly on our website.

Both individuals and organizations that work with arXivLabs have embraced and accepted our values of openness, community, excellence, and user data privacy. arXiv is committed to these values and only works with partners that adhere to them.

Have an idea for a project that will add value for arXiv's community? [**Learn more about arXivLabs**](https://info.arxiv.org/labs/index.html).

[Which authors of this paper are endorsers?](/auth/show-endorsers/2509.25149) | [Disable MathJax](javascript:setMathjaxCookie\(\)) ([What is MathJax?](https://info.arxiv.org/help/mathjax.html))