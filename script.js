/* =====================================================================
    Conectados com o Mar — script.js
    =====================================================================
    Este arquivo controla toda a interatividade do site. Ele está dividido
    em blocos, cada um com sua responsabilidade:

        1. Tela de carregamento          -> some quando a página termina de carregar
        2. Barra inferior (mobile)       -> encolhe quando o usuário rola a página
        3. Destaque da seção ativa       -> marca no menu a seção que está na tela
        4. Menu lateral (desktop)        -> abre/fecha e lembra a escolha do usuário
        5. Formulário de contato         -> abre o e-mail do usuário já preenchido
        6. Mini-jogos                    -> janela (overlay) + 4 jogos educativos
        7. Zoom nas fotos dos animais    -> amplia a foto com botões +, − e reset
   ===================================================================== */


// ---------- Tela de carregamento ----------
// Objetivo: mostrar uma tela de "carregando" que trava a rolagem e depois
// some suavemente. Ela fica visível por no mínimo 0,9 s (para não piscar)
// e no máximo 4 s (para o usuário nunca ficar preso nela).
const loadingScreen = document.getElementById('loading-screen');

// Só executa se o elemento existir no HTML (evita erro em outras páginas).
if (loadingScreen) {
    const MIN_LOADING_TIME = 900;  // para não piscar 
    const MAX_LOADING_TIME = 4000; // para não ficar muito tempo na tela
    const startTime = Date.now();  // guarda o instante em que o script começou

    // A classe 'is-loading' (definida no CSS) impede o scroll da página.
    document.body.classList.add('is-loading');

    // Esconde a tela: o CSS faz a animação de fade-out através da classe 'hide'.
    function hideLoadingScreen() {
        if (loadingScreen.classList.contains('hide')) return; // já escondida, evita rodar 2x
        loadingScreen.classList.add('hide');
        document.body.classList.remove('is-loading'); // libera o scroll de volta
        // remove do DOM depois da transição, pra não ficar invisível "no caminho"
        // { once: true } faz o evento rodar uma única vez e se remover sozinho.
        loadingScreen.addEventListener('transitionend', () => loadingScreen.remove(), { once: true });
    }

    // Calcula quanto tempo ainda falta para completar o tempo MÍNIMO
    // e agenda o sumiço da tela para esse momento.
    function scheduleHide() {
        const elapsed = Date.now() - startTime;                     // quanto tempo já passou
        const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);  // nunca negativo
        setTimeout(hideLoadingScreen, remaining);
    }

    if (document.readyState === 'complete') {
        // a página já tinha terminado de carregar quando este script rodou —
        // esperar pelo evento 'load' aqui nunca dispararia
        scheduleHide();
    } else {
        // 'load' dispara quando HTML, imagens e CSS terminaram de carregar
        window.addEventListener('load', scheduleHide);
    }

    // trava de segurança: garante que a tela some mesmo se algo der errado acima
    setTimeout(hideLoadingScreen, MAX_LOADING_TIME);
}


// ---------- Barra mobile encolhe ao rolar ----------
// Objetivo: no celular, a barra de navegação inferior fica menor depois que
// o usuário rola um pouco a página, liberando espaço na tela.
const bottomNav = document.querySelector('.bottom-nav');
const SHRINK_AFTER = 24; // px rolados antes de encolher
let ticking = false;     // "trava" que evita executar a atualização várias vezes por quadro

function updateNavShrink() {
    if (bottomNav) {
        // toggle(classe, condição): adiciona a classe se a condição for verdadeira
        // e remove se for falsa. window.scrollY = quantos pixels já foram rolados.
        bottomNav.classList.toggle('shrink', window.scrollY > SHRINK_AFTER);
    }
    ticking = false; // libera para a próxima atualização
}

// O evento 'scroll' dispara dezenas de vezes por segundo. Para não pesar,
// usamos requestAnimationFrame: a atualização acontece no máximo uma vez
// por quadro da tela, e a variável 'ticking' impede pedidos duplicados.
// { passive: true } avisa ao navegador que não vamos bloquear a rolagem.
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(updateNavShrink);
        ticking = true;
    }
}, { passive: true });


// ---------- Destaque de seção ativa ----------
// Destaca no menu (barra inferior no mobile, barra lateral no desktop)
// qual seção da página está visível no momento.
// Usa o IntersectionObserver, uma API do navegador que avisa quando um
// elemento entra ou sai da área visível da tela (mais eficiente do que
// calcular posições manualmente a cada scroll).

const sections = document.querySelectorAll('main section[id]'); // seções que têm id
const navLinks = document.querySelectorAll('.bottom-nav a, .side-nav a'); // links dos dois menus

// Marca como 'active' o link cujo href aponta para a seção informada (ex.: "#animais").
function setActive(id) {
    navLinks.forEach(link => {
        const target = link.getAttribute('href');
        link.classList.toggle('active', target === `#${id}`);
    });
}

// O observador recebe uma lista de "entradas" (as seções que mudaram de estado).
const observer = new IntersectionObserver(
    (entries) => {
        // escolhe a seção mais visível no momento
        // 1) filter: fica só com as seções que estão na tela
        // 2) sort: ordena da mais visível (maior intersectionRatio) para a menos visível
        // 3) [0]: pega a primeira, ou seja, a mais visível
        const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
    },
    // rootMargin: "encolhe" a área observada (56px a menos no topo, por causa do
    //   cabeçalho fixo, e metade da tela a menos embaixo), assim a seção só conta
    //   como ativa quando chega perto da parte de cima da tela.
    // threshold: percentuais de visibilidade (25%, 50%, 75%) em que o observador é acionado.
    { rootMargin: '-56px 0px -50% 0px', threshold: [0.25, 0.5, 0.75] }
);

// Pede ao observador para vigiar cada seção.
sections.forEach(section => observer.observe(section));

// estado inicial (antes de rolar)
if (sections.length) setActive(sections[0].id);


// ---------- Menu lateral: mostrar/ocultar (desktop) ----------
// Objetivo: botão que recolhe/expande o menu lateral e "lembra" a escolha
// do usuário na próxima visita, usando o localStorage do navegador.
const sidebarToggle = document.getElementById('sidebar-toggle');
const sideNav = document.querySelector('.side-nav');

if (sidebarToggle && sideNav) {
    // Nome ("chave") sob o qual a preferência fica guardada no navegador.
    const STORAGE_KEY = 'baia-sidebar-collapsed';

    // Aplica o estado (recolhido ou não): troca a classe do menu e o ícone do botão.
    function applySidebarState(collapsed) {
        sideNav.classList.toggle('collapsed', collapsed);
        sidebarToggle.innerHTML = collapsed
            ? '<i class="ti ti-chevrons-right"></i>'
            : '<i class="ti ti-chevrons-left"></i>';
    }

    // restaura a preferência salva da última visita
    // (o localStorage só guarda texto, por isso comparamos com a string 'true')
    applySidebarState(localStorage.getItem(STORAGE_KEY) === 'true');

    sidebarToggle.addEventListener('click', () => {
        // inverte o estado atual: se estava recolhido, expande; e vice-versa
        const collapsed = !sideNav.classList.contains('collapsed');
        applySidebarState(collapsed);
        localStorage.setItem(STORAGE_KEY, collapsed); // salva para a próxima visita
    });
}


// ---------- Formulário de contato ----------
// Não tem servidor por trás — o botão monta um link "mailto" e abre
// o programa de e-mail do usuário já com a mensagem preenchida.
const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
        // impede o comportamento padrão do formulário (recarregar a página)
        event.preventDefault();
        // .trim() remove espaços sobrando no começo e no fim do texto digitado
        const name = document.getElementById('contact-name').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        // encodeURIComponent converte caracteres especiais (espaços, acentos, quebras
        // de linha) para um formato que pode ir dentro de uma URL.
        const subject = encodeURIComponent(`Mensagem de ${name} — Conectados com o Mar`);
        const body = encodeURIComponent(`${message}\n\n— ${name}`);
        // Ao navegar para um endereço "mailto:", o navegador abre o app de e-mail.
        window.location.href = `mailto:luizambdacosta@gmail.com?subject=${subject}&body=${body}`;
    });
}


// ---------- Mini-jogos: overlay ----------
// Os jogos aparecem numa "janela" (overlay) por cima da página. Esta parte
// cuida de abrir, fechar e escolher qual jogo desenhar; a lógica de cada
// jogo fica nas funções renderXxxGame mais abaixo.
const gameOverlay = document.getElementById('game-overlay'); // fundo escuro + janela
const gameContent = document.getElementById('game-content'); // onde o jogo é desenhado
const gameClose = document.getElementById('game-close');     // botão de fechar

// Embaralha uma lista usando o algoritmo Fisher-Yates:
// percorre do fim para o começo e troca cada item com outro de posição aleatória.
// Retorna uma CÓPIA embaralhada (o array original não é modificado).
function shuffle(arr) {
    const a = [...arr]; // copia o array
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // índice aleatório de 0 até i
        [a[i], a[j]] = [a[j], a[i]]; // troca os dois elementos de lugar
    }
    return a;
}

// Cada jogo é uma função que recebe o container e desenha o próprio HTML nele.
// Os que ainda não existem ficam como 'null' e mostram "Em breve!".
// A chave (ex.: 'memoria') vem do atributo data-game do HTML de cada cartão de jogo.
const GAMES = {
    conectar: renderConnectGame,
    memoria: renderMemoryGame,
    cruzadinha: null,
    cacapalavras: renderWordSearchGame,
    descarte: renderTrashGame,
};

// Abre a janela e desenha o jogo escolhido.
function openGame(key) {
    if (!gameOverlay || !gameContent) return;
    const render = GAMES[key]; // busca a função do jogo pela chave

    if (render) {
        render(gameContent); // chama a função do jogo, passando onde desenhar
    } else {
        // jogo ainda não implementado: mostra uma mensagem amigável
        gameContent.innerHTML = `
            <h3 class="game-title">Em breve!</h3>
            <p class="game-instructions">Esse jogo ainda está sendo construído. Volte mais tarde pra jogar.</p>
        `;
    }

    gameOverlay.classList.add('open');
    // aria-hidden informa aos leitores de tela se a janela está visível (acessibilidade)
    gameOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll'); // trava a rolagem da página ao fundo
}

function closeGame() {
    if (!gameOverlay) return;
    gameOverlay.classList.remove('open');
    gameOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
}

// Liga cada cartão de jogo (.game-tile) ao clique e ao teclado.
// O trecho de teclado (Enter ou Espaço) é acessibilidade: quem não usa mouse
// também consegue abrir o jogo. preventDefault() evita que o Espaço role a página.
document.querySelectorAll('.game-tile[data-game]').forEach((tile) => {
    tile.addEventListener('click', () => openGame(tile.dataset.game));
    tile.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openGame(tile.dataset.game);
        }
    });
});

// Formas de fechar a janela: botão X, clicar no fundo escuro ou apertar Esc.
if (gameClose) gameClose.addEventListener('click', closeGame);

if (gameOverlay) {
    gameOverlay.addEventListener('click', (event) => {
        // event.target é o elemento clicado; só fecha se foi o próprio fundo,
        // e não algo dentro da janela do jogo.
        if (event.target === gameOverlay) closeGame();
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && gameOverlay && gameOverlay.classList.contains('open')) {
        closeGame();
    }
});


// ---------- Jogo: Conecte as palavras ----------
// Regra: o jogador clica num nome de animal (coluna da esquerda) e depois na
// dica correspondente (coluna da direita). Se combinarem, o par fica "matched".
function renderConnectGame(container) {
    // Dados do jogo: cada objeto liga um animal à sua dica.
    const pairs = [
        { word: 'Boto-cinza', clue: 'Golfinho que adora nadar perto dos barcos' },
        { word: 'Biguá', clue: 'Mergulha fundo e depois seca as asas no sol' },
        { word: 'Caranguejo-uçá', clue: 'Vive escondido entre as raízes do mangue' },
        { word: 'Tartaruga-verde', clue: 'Adora se alimentar de algas marinhas' },
        { word: 'Guará', clue: 'Fica vermelho de tanto comer caranguejo' },
        { word: 'Aratu', clue: 'Caranguejo ágil que sobe em troncos e raízes' },
    ];

    // Cada palavra e sua dica recebem o MESMO id (o índice do par). É assim que o
    // jogo sabe se uma dica combina com uma palavra. As duas listas são embaralhadas
    // separadamente para que os pares não fiquem lado a lado.
    const words = shuffle(pairs.map((p, i) => ({ id: i, text: p.word })));
    const clues = shuffle(pairs.map((p, i) => ({ id: i, text: p.clue })));

    // Estado do jogo: o que está selecionado agora e quantos pares já foram feitos.
    let selectedWord = null;
    let selectedClue = null;
    let matchedCount = 0;

    // Desenha a estrutura do jogo (título, instruções, colunas vazias e mensagem de vitória).
    // ${...} dentro de crases (template string) insere valores do JavaScript no texto.
    container.innerHTML = `
        <h3 class="game-title">Conecte as palavras</h3>
        <p class="game-instructions">Toque no nome do animal e depois na dica certa pra formar o par.</p>
        <p class="game-progress"><span id="connect-progress">0</span> de ${pairs.length} conectados</p>
        <div class="connect-grid">
            <div class="connect-col" id="connect-words"></div>
            <div class="connect-col" id="connect-clues"></div>
        </div>
        <div id="connect-win" class="game-win" hidden>
            <p>🎉 Você conectou todos os pares!</p>
            <button id="connect-restart" class="navbtn blue">Jogar de novo</button>
        </div>
    `;

    // Guarda referências aos elementos que serão usados depois.
    const wordsEl = container.querySelector('#connect-words');
    const cluesEl = container.querySelector('#connect-clues');
    const progressEl = container.querySelector('#connect-progress');
    const winEl = container.querySelector('#connect-win');
    const gridEl = container.querySelector('.connect-grid');

    // Cria um botão para cada palavra e cada dica. Os atributos data-id e data-type
    // guardam, no próprio HTML, o número do par e se o botão é "word" ou "clue".
    wordsEl.innerHTML = words
        .map((w) => `<button class="connect-tile" data-id="${w.id}" data-type="word">${w.text}</button>`)
        .join('');
    cluesEl.innerHTML = clues
        .map((c) => `<button class="connect-tile" data-id="${c.id}" data-type="clue">${c.text}</button>`)
        .join('');

    // Delegação de eventos: em vez de um "ouvinte" em cada botão, há um só no
    // container. closest() descobre qual botão foi clicado (mesmo que o clique
    // tenha sido em algo dentro dele).
    gridEl.addEventListener('click', (event) => {
        const btn = event.target.closest('.connect-tile');
        if (!btn || btn.classList.contains('matched')) return; // ignora cliques fora dos botões e pares já feitos

        // Marca o botão clicado como selecionado, desmarcando o anterior da mesma coluna.
        if (btn.dataset.type === 'word') {
            if (selectedWord) selectedWord.classList.remove('selected');
            selectedWord = btn;
            btn.classList.add('selected');
        } else {
            if (selectedClue) selectedClue.classList.remove('selected');
            selectedClue = btn;
            btn.classList.add('selected');
        }

        // Só avalia o par quando há uma palavra E uma dica selecionadas.
        if (!selectedWord || !selectedClue) return;

        if (selectedWord.dataset.id === selectedClue.dataset.id) {
            // ACERTOU: mesmo id = par correto. Troca 'selected' por 'matched' (verde, travado).
            selectedWord.classList.remove('selected');
            selectedClue.classList.remove('selected');
            selectedWord.classList.add('matched');
            selectedClue.classList.add('matched');
            matchedCount++;
            progressEl.textContent = matchedCount; // atualiza o contador na tela
            selectedWord = null; // limpa a seleção para a próxima tentativa
            selectedClue = null;

            if (matchedCount === pairs.length) {
                winEl.hidden = false; // todos os pares feitos: mostra a mensagem de vitória
            }
        } else {
            // ERROU: mostra a cor de erro por meio segundo e depois limpa.
            // As variáveis wrongWord/wrongClue guardam os botões, porque
            // selectedWord/selectedClue são zerados logo abaixo, antes do setTimeout rodar.
            const wrongWord = selectedWord;
            const wrongClue = selectedClue;
            wrongWord.classList.add('wrong');
            wrongClue.classList.add('wrong');
            setTimeout(() => {
                wrongWord.classList.remove('selected', 'wrong');
                wrongClue.classList.remove('selected', 'wrong');
            }, 500);
            selectedWord = null;
            selectedClue = null;
        }
    });

    // "Jogar de novo": chama a própria função outra vez, o que redesenha tudo do zero.
    container.querySelector('#connect-restart').addEventListener('click', () => {
        renderConnectGame(container);
    });
}


// ---------- Jogo: Descarte correto ----------
// Regra: aparece um item de lixo por vez e o jogador escolhe a lixeira certa
// (orgânico, reciclável ou rejeito). Cada resposta mostra uma explicação educativa.
function renderTrashGame(container) {
    // Cada item tem: nome, ícone, lixeira correta ('bin') e uma curiosidade ('info').
    const items = [
        { name: 'Casca de fruta', icon: 'ti-apple', bin: 'organico', info: '2 a 12 meses pra decompor — pode ir na compostagem ou no lixo orgânico.' },
        { name: 'Bituca de cigarro', icon: 'ti-smoking', bin: 'rejeito', info: 'Mais de 5 anos pra decompor, e ainda solta veneno na água.' },
        { name: 'Garrafa/sacola plástica', icon: 'ti-bottle', bin: 'reciclavel', info: 'Mais de 400 anos pra decompor — separe pra reciclagem.' },
        { name: 'Lata de alumínio', icon: 'ti-trash', bin: 'reciclavel', info: 'É 100% reciclável — sempre separe pra reciclagem.' },
        { name: 'Garrafa de vidro', icon: 'ti-glass-full', bin: 'reciclavel', info: 'Praticamente não desaparece da natureza — recicle sempre.' },
        { name: 'Isopor', icon: 'ti-box', bin: 'rejeito', info: 'Não se decompõe, só se quebra em pedacinhos — descarte bem fechado.' },
        { name: 'Rede/linha de pesca', icon: 'ti-anchor', bin: 'rejeito', info: 'Um dos maiores perigos pra animais marinhos — nunca abandone na água.' },
        { name: 'Pneu', icon: 'ti-circle', bin: 'rejeito', info: 'Leve pra um ponto de coleta — muitos lugares reaproveitam pneus velhos.' },
    ];

    // As três lixeiras. 'key' precisa ser igual ao campo 'bin' dos itens acima.
    const bins = [
        { key: 'organico', label: 'Orgânico', icon: 'ti-leaf' },
        { key: 'reciclavel', label: 'Reciclável', icon: 'ti-recycle' },
        { key: 'rejeito', label: 'Rejeito', icon: 'ti-trash-x' },
    ];

    // Estado do jogo.
    const queue = shuffle(items); // ordem aleatória dos itens
    let index = 0;                // posição do item atual na fila
    let score = 0;                // acertos
    let locked = false;           // true enquanto o feedback é exibido (impede clicar duas vezes)

    container.innerHTML = `
        <h3 class="game-title">Descarte correto</h3>
        <p class="game-instructions">Toque na lixeira certa pra cada lixo que aparecer na tela.</p>
        <p class="game-progress"><span id="trash-score">0</span> acertos · item <span id="trash-count">1</span> de ${items.length}</p>
        <div class="trash-stage">
            <div class="trash-item" id="trash-item">
                <i class="ti"></i>
                <span id="trash-name"></span>
            </div>
            <p id="trash-feedback" class="trash-feedback" aria-live="polite"></p>
        </div>
        <div class="trash-bins">
            ${bins.map((b) => `<button class="trash-bin" data-bin="${b.key}"><i class="ti ${b.icon}"></i>${b.label}</button>`).join('')}
        </div>
        <div id="trash-win" class="game-win" hidden>
            <p></p>
            <button id="trash-restart" class="navbtn blue">Jogar de novo</button>
        </div>
    `;

    // Referências aos elementos que serão atualizados durante o jogo.
    // (aria-live="polite" no HTML acima faz leitores de tela lerem o feedback em voz alta.)
    const itemEl = container.querySelector('#trash-item');
    const iconEl = itemEl.querySelector('i');
    const nameEl = container.querySelector('#trash-name');
    const feedbackEl = container.querySelector('#trash-feedback');
    const scoreEl = container.querySelector('#trash-score');
    const countEl = container.querySelector('#trash-count');
    const binButtons = container.querySelectorAll('.trash-bin');
    const winEl = container.querySelector('#trash-win');
    const stageEl = container.querySelector('.trash-stage');
    const binsWrap = container.querySelector('.trash-bins');

    // Mostra na tela o item da vez (ícone, nome) e limpa o feedback anterior.
    function showItem() {
        const current = queue[index];
        iconEl.className = `ti ${current.icon}`;
        nameEl.textContent = current.name;
        feedbackEl.textContent = '';
        feedbackEl.className = 'trash-feedback';
        countEl.textContent = index + 1; // index começa em 0, mas o jogador vê "item 1"
    }

    // Fim do jogo: esconde item e lixeiras e mostra a pontuação final.
    function finish() {
        stageEl.hidden = true;
        binsWrap.hidden = true;
        winEl.hidden = false;
        winEl.querySelector('p').textContent = `🎉 Você acertou ${score} de ${items.length}!`;
    }

    // Avança para o próximo item, ou encerra se a fila acabou.
    function nextItem() {
        index++;
        if (index >= queue.length) {
            finish();
        } else {
            showItem();
            locked = false; // libera os cliques para o novo item
        }
    }

    // Um "ouvinte" de clique para cada lixeira.
    binButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (locked) return; // ignora cliques enquanto o feedback aparece
            locked = true;
            const current = queue[index];
            // data-bin da lixeira clicada é comparado com a lixeira correta do item
            const correct = btn.dataset.bin === current.bin;

            if (correct) {
                score++;
                scoreEl.textContent = score;
                feedbackEl.textContent = `Isso! ${current.info}`;
                feedbackEl.classList.add('right');
                itemEl.classList.add('correct-pop'); // animação de acerto (CSS)
            } else {
                feedbackEl.textContent = `Quase! ${current.info}`;
                feedbackEl.classList.add('wrong');
                itemEl.classList.add('shake');       // animação de erro (CSS)
            }

            // Espera 1,4 s para o jogador ler a explicação antes de passar ao próximo.
            setTimeout(() => {
                itemEl.classList.remove('correct-pop', 'shake');
                nextItem();
            }, 1400);
        });
    });

    container.querySelector('#trash-restart').addEventListener('click', () => {
        renderTrashGame(container);
    });

    showItem(); // mostra o primeiro item assim que o jogo é desenhado
}


// ---------- Jogo: Jogo da memória ----------
// Regra: 12 cartas viradas para baixo (6 animais x 2). O jogador vira duas por
// vez; se forem do mesmo animal, ficam abertas; se não, viram de volta.
function renderMemoryGame(container) {
    const animals = [
        { name: 'Boto-cinza', img: './assets/animals/boto-cinza1.jpg' },
        { name: 'Biguá', img: './assets/animals/bigua2.jpg' },
        { name: 'Caranguejo-uçá', img: './assets/animals/caranguejo-uca1.jpg' },
        { name: 'Tartaruga-verde', img: './assets/animals/tartaruga-verde1.jpg' },
        { name: 'Guará', img: './assets/animals/guara2.jpg' },
        { name: 'Aratu', img: './assets/animals/aratu2.jpg' },
    ];

    // Monta o baralho em 3 passos:
    // 1) flatMap: cada animal vira DUAS cartas com o mesmo pairId (o índice do animal);
    //    "...a" copia nome e imagem para dentro de cada carta.
    // 2) shuffle: embaralha as 12 cartas.
    // 3) map: dá a cada carta um uid único (posição no baralho) para identificá-la.
    const deck = shuffle(
        animals.flatMap((a, i) => [
            { pairId: i, ...a },
            { pairId: i, ...a },
        ])
    ).map((card, i) => ({ ...card, uid: i }));

    // Estado do jogo.
    let flipped = [];      // cartas viradas na jogada atual (no máximo 2)
    let matchedCount = 0;  // pares já encontrados
    let moves = 0;         // jogadas realizadas (cada par virado conta 1)
    let locked = false;    // true enquanto duas cartas erradas aguardam desvirar

    container.innerHTML = `
        <h3 class="game-title">Jogo da memória</h3>
        <p class="game-instructions">Vire duas cartas por vez e tente achar os pares de animais.</p>
        <p class="game-progress"><span id="memory-moves">0</span> jogadas · <span id="memory-progress">0</span> de ${animals.length} pares</p>
        <div class="memory-grid" id="memory-grid"></div>
        <div id="memory-win" class="game-win" hidden>
            <p>🎉 Você encontrou todos os pares!</p>
            <button id="memory-restart" class="navbtn blue">Jogar de novo</button>
        </div>
    `;

    const gridEl = container.querySelector('#memory-grid');
    const movesEl = container.querySelector('#memory-moves');
    const progressEl = container.querySelector('#memory-progress');
    const winEl = container.querySelector('#memory-win');

    // Cada carta tem duas faces: o verso (ícone de âncora) e a frente (foto do animal).
    // O CSS faz o efeito de virar a carta quando ela recebe a classe 'flipped'.
    gridEl.innerHTML = deck.map((card) => `
        <button class="memory-card" data-uid="${card.uid}" data-pair="${card.pairId}">
            <span class="memory-card-inner">
                <span class="memory-card-face memory-card-back"><i class="ti ti-anchor"></i></span>
                <span class="memory-card-face memory-card-front"><img src="${card.img}" alt="${card.name}"></span>
            </span>
        </button>
    `).join('');

    // Delegação de eventos: um único "ouvinte" no tabuleiro cuida de todas as cartas.
    gridEl.addEventListener('click', (event) => {
        const btn = event.target.closest('.memory-card');
        if (!btn || locked) return;                                                    // clique fora de carta ou jogo travado
        if (btn.classList.contains('flipped') || btn.classList.contains('matched')) return; // carta já virada ou já encontrada
        if (flipped.length === 2) return;                                              // já há duas cartas viradas

        btn.classList.add('flipped');
        flipped.push(btn);

        // Quando a segunda carta é virada, compara as duas.
        if (flipped.length === 2) {
            moves++;
            movesEl.textContent = moves;
            const [a, b] = flipped; // desestruturação: a = primeira carta, b = segunda

            if (a.dataset.pair === b.dataset.pair) {
                // ACERTOU: cartas do mesmo animal ficam abertas para sempre.
                a.classList.add('matched');
                b.classList.add('matched');
                flipped = [];
                matchedCount++;
                progressEl.textContent = matchedCount;
                if (matchedCount === animals.length) winEl.hidden = false;
            } else {
                // ERROU: trava o jogo por 0,8 s (tempo de ver as cartas) e desvira as duas.
                locked = true;
                setTimeout(() => {
                    a.classList.remove('flipped');
                    b.classList.remove('flipped');
                    flipped = [];
                    locked = false;
                }, 800);
            }
        }
    });

    container.querySelector('#memory-restart').addEventListener('click', () => {
        renderMemoryGame(container);
    });
}


// ---------- Jogo: Caça-palavras ----------
// Regra: uma grade 10x10 esconde as palavras da lista. O jogador arrasta o dedo
// (ou o mouse) sobre as letras em linha reta para selecionar uma palavra.
// O jogo tem duas partes: (1) gerar a grade e (2) tratar o arrastar do jogador.
function renderWordSearchGame(container) {
    const SIZE = 10; // a grade tem SIZE linhas e SIZE colunas
    const words = ['BOTO', 'MANGUE', 'PRAIA', 'PEIXE', 'MAR', 'GUARA'];
    // Direções em que as palavras podem ser escondidas. dr = quanto a linha (row)
    // avança a cada letra; dc = quanto a coluna (col) avança.
    const DIRECTIONS = [
        { dr: 0, dc: 1 },  // direita
        { dr: 1, dc: 0 },  // baixo
        { dr: 1, dc: 1 },  // diagonal
    ];

    // ----- Parte 1: gerar a grade -----
    function buildGrid() {
        // Cria uma matriz SIZE x SIZE preenchida com null (células vazias).
        const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

        // Para cada palavra, tenta posições aleatórias até encontrar uma que caiba.
        words.forEach((word) => {
            let placed = false;
            let attempts = 0;
            // Limite de 200 tentativas evita um loop infinito. Se a palavra não coubesse
            // (caso raríssimo nesta grade), ela simplesmente ficaria de fora.
            while (!placed && attempts < 200) {
                attempts++;
                // sorteia uma direção
                const dir = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
                // Calcula até onde a posição inicial pode ir para a palavra não passar
                // da borda da grade (só restringe o eixo em que a palavra avança).
                const maxRow = dir.dr ? SIZE - word.length : SIZE - 1;
                const maxCol = dir.dc ? SIZE - word.length : SIZE - 1;
                if (maxRow < 0 || maxCol < 0) continue; // palavra maior que a grade
                // sorteia a posição inicial dentro do limite calculado
                const row = Math.floor(Math.random() * (maxRow + 1));
                const col = Math.floor(Math.random() * (maxCol + 1));

                // Verifica se todas as letras cabem: cada célula precisa estar vazia
                // ou já conter a mesma letra (permite que palavras se cruzem).
                let fits = true;
                for (let i = 0; i < word.length; i++) {
                    const r = row + dir.dr * i;
                    const c = col + dir.dc * i;
                    const existing = grid[r][c];
                    if (existing && existing !== word[i]) { fits = false; break; }
                }
                if (!fits) continue; // não coube: sorteia outra posição

                // Coube: escreve as letras da palavra na grade.
                for (let i = 0; i < word.length; i++) {
                    const r = row + dir.dr * i;
                    const c = col + dir.dc * i;
                    grid[r][c] = word[i];
                }
                placed = true;
            }
        });

        // Preenche as células que sobraram com letras aleatórias do alfabeto.
        const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (!grid[r][c]) grid[r][c] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
            }
        }
        return grid;
    }

    const grid = buildGrid();

    // Estado do jogo.
    const foundWords = new Set(); // palavras já encontradas (Set não aceita repetidas)
    let selecting = false;        // true enquanto o jogador está arrastando
    let startCell = null;         // célula onde o arrasto começou
    let currentPath = [];         // células atualmente selecionadas
    let pointerUpHandler = null;  // guarda a função de "soltar" para poder removê-la depois

    container.innerHTML = `
        <h3 class="game-title">Caça-palavras</h3>
        <p class="game-instructions">Arraste o dedo (ou o mouse) sobre as letras pra formar uma palavra da lista.</p>
        <div class="ws-words" id="ws-words">
            ${words.map((w) => `<span class="ws-word" data-word="${w}">${w}</span>`).join('')}
        </div>
        <div class="ws-grid" id="ws-grid" style="grid-template-columns:repeat(${SIZE},1fr)"></div>
        <div id="ws-win" class="game-win" hidden>
            <p>🎉 Você encontrou todas as palavras!</p>
            <button id="ws-restart" class="navbtn blue">Jogar de novo</button>
        </div>
    `;

    const gridEl = container.querySelector('#ws-grid');
    const wordsEl = container.querySelector('#ws-words');
    const winEl = container.querySelector('#ws-win');

    // Desenha a grade na tela: uma <span> por letra, guardando linha e coluna
    // em data-row e data-col para sabermos qual célula o jogador tocou.
    gridEl.innerHTML = grid.map((row, r) =>
        row.map((letter, c) => `<span class="ws-cell" data-row="${r}" data-col="${c}">${letter}</span>`).join('')
    ).join('');

    // ----- Parte 2: tratar o arrastar do jogador -----

    // Dadas a célula inicial e a final, devolve a lista de células entre elas.
    // Só aceita linhas retas (horizontal, vertical ou diagonal a 45°);
    // se o arrasto sair dessas direções, devolve null.
    function cellsInLine(start, end) {
        const dRow = end.row - start.row; // deslocamento vertical
        const dCol = end.col - start.col; // deslocamento horizontal
        // Não é reta se andou nos dois eixos com tamanhos diferentes.
        if (dRow !== 0 && dCol !== 0 && Math.abs(dRow) !== Math.abs(dCol)) return null;
        const steps = Math.max(Math.abs(dRow), Math.abs(dCol)); // quantas casas andou
        const stepRow = Math.sign(dRow); // direção em cada eixo: -1, 0 ou 1
        const stepCol = Math.sign(dCol);
        const path = [];
        for (let i = 0; i <= steps; i++) {
            path.push({ row: start.row + stepRow * i, col: start.col + stepCol * i });
        }
        return path;
    }

    // Remove o destaque temporário ('selecting') de todas as células.
    function clearSelectionStyles() {
        gridEl.querySelectorAll('.ws-cell.selecting').forEach((el) => el.classList.remove('selecting'));
    }

    // Descobre qual célula da grade está sob o dedo/mouse. Usamos coordenadas da
    // tela (clientX/clientY) porque, ao arrastar no celular, o evento continua
    // "preso" à primeira célula tocada — então precisamos perguntar o que há embaixo do dedo.
    function getCellFromPoint(clientX, clientY) {
        const el = document.elementFromPoint(clientX, clientY);
        if (!el || !el.classList.contains('ws-cell')) return null; // dedo fora da grade
        return { row: Number(el.dataset.row), col: Number(el.dataset.col) };
    }

    // Pinta as células do caminho atual com a classe 'selecting'.
    function highlightPath(path) {
        clearSelectionStyles();
        path.forEach((p) => {
            const el = gridEl.querySelector(`.ws-cell[data-row="${p.row}"][data-col="${p.col}"]`);
            if (el) el.classList.add('selecting');
        });
    }

    // Dedo/mouse pressionado: começa a seleção na célula tocada.
    function onPointerDown(event) {
        const cell = getCellFromPoint(event.clientX, event.clientY);
        if (!cell) return;
        selecting = true;
        startCell = cell;
        currentPath = [cell];
        highlightPath(currentPath);
        event.preventDefault(); // evita rolar a página ou selecionar texto ao arrastar
    }

    // Dedo/mouse se movendo: atualiza a seleção até a célula sob o dedo.
    function onPointerMove(event) {
        if (!selecting) return; // só age se o arrasto começou
        const cell = getCellFromPoint(event.clientX, event.clientY);
        if (!cell) return;
        const path = cellsInLine(startCell, cell);
        if (!path) return; // fora de linha reta: mantém a seleção anterior
        currentPath = path;
        highlightPath(currentPath);
        event.preventDefault();
    }

    // Dedo/mouse solto: confere se as letras selecionadas formam uma palavra da lista.
    function onPointerUp() {
        if (!selecting) return;
        selecting = false;

        // Junta as letras do caminho num texto e também na ordem inversa,
        // porque o jogador pode arrastar da direita para a esquerda ou de baixo para cima.
        const letters = currentPath.map((p) => grid[p.row][p.col]).join('');
        const reversed = letters.split('').reverse().join('');
        // Procura uma palavra que ainda não foi encontrada e que combine em qualquer sentido.
        const match = words.find((w) => (w === letters || w === reversed) && !foundWords.has(w));

        if (match) {
            // ACERTOU: registra a palavra e marca as células como 'found' (fixas).
            foundWords.add(match);
            currentPath.forEach((p) => {
                const el = gridEl.querySelector(`.ws-cell[data-row="${p.row}"][data-col="${p.col}"]`);
                if (el) { el.classList.remove('selecting'); el.classList.add('found'); }
            });
            // Risca a palavra na lista acima da grade.
            const wordEl = wordsEl.querySelector(`.ws-word[data-word="${match}"]`);
            if (wordEl) wordEl.classList.add('found');
            // Todas encontradas: mostra a vitória.
            if (foundWords.size === words.length) winEl.hidden = false;
        } else {
            clearSelectionStyles(); // não formou palavra: apaga o destaque
        }

        // Zera a seleção para o próximo arrasto.
        currentPath = [];
        startCell = null;
    }

    // Os eventos "pointer" funcionam igual para mouse, toque e caneta.
    // 'pointerdown' e 'pointermove' ficam na grade; 'pointerup' fica na janela inteira
    // para detectar quando o jogador solta o dedo mesmo fora da grade.
    gridEl.addEventListener('pointerdown', onPointerDown);
    gridEl.addEventListener('pointermove', onPointerMove);
    pointerUpHandler = onPointerUp;
    window.addEventListener('pointerup', pointerUpHandler);

    // Ao reiniciar, é preciso remover o 'pointerup' da janela; senão, cada partida
    // deixaria um ouvinte antigo ativo (vazamento de memória / comportamento duplicado).
    container.querySelector('#ws-restart').addEventListener('click', () => {
        window.removeEventListener('pointerup', pointerUpHandler);
        renderWordSearchGame(container);
    });
}


// ---------- Animais: zoom das fotos ----------
// Objetivo: ao clicar na foto de um animal, abre uma janela com a imagem
// ampliada, o nome e a descrição, com botões para aproximar e afastar.
const zoomOverlay = document.getElementById('zoom-overlay');
const zoomImg = document.getElementById('zoom-img');
const zoomName = document.getElementById('zoom-name');
const zoomDesc = document.getElementById('zoom-desc');
const zoomClose = document.getElementById('zoom-close');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');

// Limites do zoom: de 1x (tamanho normal) até 3x, em passos de 0,5.
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;
let zoomScale = 1; // nível de zoom atual

// Aplica o nível de zoom à imagem usando CSS transform: scale(...).
function applyZoomScale() {
    if (zoomImg) zoomImg.style.transform = `scale(${zoomScale})`;
}

// Abre o zoom com os dados do cartão (card) e da imagem (img) clicados.
function openZoom(card, img) {
    if (!zoomOverlay || !zoomImg) return;
    zoomImg.src = img.src;
    zoomImg.alt = img.alt; // texto alternativo, importante para acessibilidade
    zoomScale = 1;         // sempre abre no tamanho normal
    applyZoomScale();

    // Reaproveita o nome e a descrição que já existem no cartão do animal.
    // 'p:not(.credit)' pega o parágrafo que NÃO é o crédito da foto.
    const namePill = card.querySelector('.name-pill');
    const desc = card.querySelector('p:not(.credit)');
    if (zoomName) {
        // se não achar a "pílula" com o nome, usa o texto alternativo da imagem
        zoomName.textContent = namePill ? namePill.textContent : img.alt;
        // copia a cor de fundo da pílula para manter a identidade visual de cada animal
        zoomName.style.background = namePill ? getComputedStyle(namePill).backgroundColor : '';
    }
    if (zoomDesc) zoomDesc.textContent = desc ? desc.textContent : '';

    zoomOverlay.classList.add('open');
    zoomOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
}

function closeZoom() {
    if (!zoomOverlay) return;
    zoomOverlay.classList.remove('open');
    zoomOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
}

// Torna a foto de cada animal clicável. Como o elemento original é apenas uma
// imagem, adicionamos role="button" e tabindex="0" para que leitores de tela e o
// teclado (Tab, Enter, Espaço) também consigam usá-lo. O aria-label descreve a ação.
document.querySelectorAll('#animais .animal-card').forEach((card) => {
    const avatar = card.querySelector('.avatar');
    const img = avatar ? avatar.querySelector('img') : null;
    if (!avatar || !img) return; // cartão sem foto: ignora
    avatar.setAttribute('role', 'button');
    avatar.setAttribute('tabindex', '0');
    avatar.setAttribute('aria-label', `Ver ${img.alt} de perto`);
    avatar.addEventListener('click', () => openZoom(card, img));
    avatar.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openZoom(card, img);
        }
    });
});

// Formas de fechar o zoom: botão X, clicar no fundo escuro ou apertar Esc.
if (zoomClose) zoomClose.addEventListener('click', closeZoom);

if (zoomOverlay) {
    zoomOverlay.addEventListener('click', (event) => {
        if (event.target === zoomOverlay) closeZoom(); // só o fundo, não a imagem
    });
}

// Botão "+": aumenta o zoom. Math.min impede de passar do máximo.
if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
        zoomScale = Math.min(ZOOM_MAX, zoomScale + ZOOM_STEP);
        applyZoomScale();
    });
}

// Botão "−": diminui o zoom. Math.max impede de ficar abaixo do mínimo.
if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
        zoomScale = Math.max(ZOOM_MIN, zoomScale - ZOOM_STEP);
        applyZoomScale();
    });
}

// Botão de reset: volta ao tamanho normal.
if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
        zoomScale = 1;
        applyZoomScale();
    });
}

// Duplo clique na imagem alterna entre tamanho normal (1x) e ampliado (2x).
if (zoomImg) {
    zoomImg.addEventListener('dblclick', () => {
        zoomScale = zoomScale > 1 ? 1 : 2;
        applyZoomScale();
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && zoomOverlay && zoomOverlay.classList.contains('open')) {
        closeZoom();
    }
});