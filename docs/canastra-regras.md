# Canastra Suja (em dupla) — Regras da Casa

Jogo online de canastra suja, **em dupla (dupla x dupla)**, para jogar entre amigos.
Sem login: o jogador entra na mesa por **código de sala + nome**.

> Este documento é a fonte de verdade das regras. Atualizar aqui sempre que algo mudar.

## Mesa e duplas
- Mesa de **4 jogadores**, **2 duplas** (dupla x dupla).
- Cada jogador **adiciona o nome** ao entrar na mesa.
- Ao **fechar 4 jogadores**, as **duplas são sorteadas**.
- Parceiros sentam cruzado: assentos **1 e 3 = Dupla 1**; **2 e 4 = Dupla 2**.
- Cada dupla **baixa o jogo** de forma compartilhada: cada jogador vê o jogo baixado
  na sua frente, mas é **o mesmo jogo da dupla**.

## Baralho e distribuição
- **2 baralhos** combinados (cartas limitadas — só existe o que há em 2 baralhos).
- Embaralhar simulando uma pessoa no modo tradicional, **3 vezes**.
- Cada jogador sai com **13 cartas**.
- **Sem tempo limite por jogada** — o jogador pensa o quanto quiser.
- Quem sai jogando pode **não querer a 1ª carta comprada**: descarta e compra outra.

## Cartas especiais
- **2 = Coringa** (curinga).
- **3 preto** = **-100 pontos**. Ao bater/finalizar, **cada 3 preto na mão conta -100**.
  - **3 preto tranca a mesa**: se um jogador descarta um 3 preto, o próximo **não pode
    levar a mesa** (o monte de descarte).
- **3 vermelho** = **+100 pontos**. Quem começa com um na mão **compra outra carta** e a
  **dupla ganha 100 pontos**.
  - **Ordem de compra do 3 vermelho**: por mão, começando pelo jogador **à direita de quem
    embaralhou**. Se ele tiver 3 vermelho, **compra outro 3 vermelho** também.

## Canastras
- Sequência da canastra vai do **4 até o Ás (A)**.
- **Canastra = 7 cartas.**
- Canastra de cartas **iguais** só é permitida para **Ás e 4**.
- **Canastra suja** (com coringa) = **100 pontos**.
- **Canastra limpa** (sem coringa) = **200 pontos**.
  - Cada **carta extra além das 7** numa canastra **limpa** = **+100 pontos** cada.
  - (Na **suja**, não há bônus por carta extra — fica fixa em 100.)

## Bater (encerrar a rodada)
- **Bater** = baixar todas as cartas na mesa.
- Para bater é **obrigatório a dupla ter pelo menos uma canastra** (suja ou limpa).
- A rodada termina quando alguém bate; então **conta-se os pontos de cada dupla**.

## Pontuação das cartas (na contagem)
| Carta | Pontos |
|-------|--------|
| 4 ao 8 | 5 |
| 9 ao K | 10 |
| Ás (A) | 20 |
| Coringa (2) | 50 |
| Quem **bateu** | +100 |
| 3 vermelho | +100 (cada) |
| 3 preto (na mão ao final) | -100 (cada) |

## Fim da partida e "obrigada"
- A partida termina quando a **primeira dupla atinge 4000 pontos**.
- A partir de **2000 pontos**, a dupla só pode **"sair da obrigada"** se conseguir
  **baixar 150 pontos na mesa** para sair.

---

## Etapas de construção
1. **Sala + Lobby (tempo real)** — criar/entrar por código, nome, ver 4 assentos ao vivo, sorteio das duplas.
2. **Baralho + distribuição** — 2 baralhos, embaralho 3x, 13 cartas, 3 vermelho/compra inicial, descarte da 1ª carta.
3. **Jogadas** — comprar/descartar, baixar jogo (compartilhado por dupla), coringa, trancar mesa (3 preto). Sem tempo limite por jogada.
4. **Pontuação e fim** — contagem por carta, canastras limpa/suja, bater, obrigada 150, 4000 pts.

## Dúvidas a confirmar nas próximas etapas
- Tem **"morto"** (mão extra) como na canastra brasileira tradicional? (não mencionado — assumindo **que não** por enquanto)
- Sequência exige **mesmo naipe**? (assumindo sequência do mesmo naipe; confirmar)
- "Levar a mesa" (pegar o monte de descarte): condições para pegar o monte?
- Limite de coringas por canastra suja? (tradicionalmente 1; confirmar)
