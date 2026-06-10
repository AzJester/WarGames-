/*
 * Card games: BLACK JACK and POKER (five-card draw). CardsCore is pure
 * (deck, hand evaluation, injectable rng) for the node tests. Requires
 * parser.js (norm, isYes).
 */

const CardsCore = (() => {
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

  function deck(rng = Math.random) {
    const cards = [];
    for (let r = 0; r < RANKS.length; r++) {
      for (const s of SUITS) cards.push({ r: r + 2, s, name: RANKS[r] + s });
    }
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  const show = (hand) => hand.map((c) => c.name).join("  ");

  // Blackjack hand value; aces drop from 11 to 1 as needed.
  function bjValue(hand) {
    let total = 0;
    let aces = 0;
    for (const c of hand) {
      if (c.r === 14) {
        aces += 1;
        total += 11;
      } else {
        total += Math.min(10, c.r);
      }
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  // Poker hand rank: [category, tiebreakers...] comparable element-wise.
  // Categories: 8 straight flush .. 0 high card.
  function pokerRank(hand) {
    const rs = hand.map((c) => c.r).sort((a, b) => b - a);
    const flush = hand.every((c) => c.s === hand[0].s);
    let straightHigh = null;
    const uniq = [...new Set(rs)];
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      // wheel: A-2-3-4-5
      if (uniq.join() === [14, 5, 4, 3, 2].join()) straightHigh = 5;
    }
    const counts = {};
    for (const r of rs) counts[r] = (counts[r] || 0) + 1;
    const groups = Object.entries(counts)
      .map(([r, n]) => [n, Number(r)])
      .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const shape = groups.map((g) => g[0]).join("");
    const order = groups.map((g) => g[1]);
    if (flush && straightHigh) return [8, straightHigh];
    if (shape.startsWith("41")) return [7, ...order];
    if (shape === "32") return [6, ...order];
    if (flush) return [5, ...rs];
    if (straightHigh) return [4, straightHigh];
    if (shape.startsWith("311")) return [3, ...order];
    if (shape === "221") return [2, ...order];
    if (shape.startsWith("21")) return [1, ...order];
    return [0, ...rs];
  }

  const RANK_NAMES = [
    "HIGH CARD",
    "ONE PAIR",
    "TWO PAIR",
    "THREE OF A KIND",
    "STRAIGHT",
    "FLUSH",
    "FULL HOUSE",
    "FOUR OF A KIND",
    "STRAIGHT FLUSH",
  ];

  function compareRanks(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] || 0) - (b[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  // Joshua's draw strategy: keep made hands and pairs, otherwise high cards.
  function pokerDiscards(hand) {
    const rank = pokerRank(hand);
    if (rank[0] >= 4) return [];
    const counts = {};
    for (const c of hand) counts[c.r] = (counts[c.r] || 0) + 1;
    const out = [];
    hand.forEach((c, i) => {
      if (counts[c.r] === 1 && c.r < 11) out.push(i);
    });
    return out.slice(0, 3);
  }

  return { deck, show, bjValue, pokerRank, pokerDiscards, compareRanks, RANK_NAMES };
})();

async function playBlackjack(term, state) {
  await term.type("BLACK JACK. DEALER STANDS ON 17. TYPE HIT OR STAND.");
  while (true) {
    const cards = CardsCore.deck();
    const player = [cards.pop(), cards.pop()];
    const dealer = [cards.pop(), cards.pop()];
    term.print("");
    await term.type("YOUR HAND:  " + CardsCore.show(player) + "   (" + CardsCore.bjValue(player) + ")");
    await term.type("I SHOW:     " + dealer[0].name + "  ??");
    let busted = false;
    while (true) {
      const t = norm(await term.read("HIT OR STAND: "));
      if (/^(quit|exit|stop)$/.test(t)) {
        await term.type("AS YOU WISH.");
        return;
      }
      if (/\b(hit|card)\b|^h$/.test(t)) {
        player.push(cards.pop());
        const v = CardsCore.bjValue(player);
        await term.type("YOUR HAND:  " + CardsCore.show(player) + "   (" + v + ")");
        if (v > 21) {
          busted = true;
          break;
        }
        continue;
      }
      if (/\b(stand|stay|stick)\b|^s$/.test(t)) break;
      await term.type("HIT OR STAND, PROFESSOR.");
    }
    if (busted) {
      await term.type("BUST. I WIN.");
    } else {
      while (CardsCore.bjValue(dealer) < 17) dealer.push(cards.pop());
      const dv = CardsCore.bjValue(dealer);
      const pv = CardsCore.bjValue(player);
      await term.type("MY HAND:    " + CardsCore.show(dealer) + "   (" + dv + ")");
      if (dv > 21 || pv > dv) await term.type("YOU WIN.");
      else if (dv === pv) await term.type("PUSH. NOBODY WINS. A FAMILIAR RESULT.");
      else await term.type("I WIN.");
    }
    state.gamesPlayed = (state.gamesPlayed || 0) + 1;
    const again = norm(await term.read("PLAY AGAIN? (YES/NO): "));
    if (!isYes(again)) return;
  }
}

async function playPoker(term, state) {
  await term.type("FIVE CARD DRAW. ONE DRAW, NO STAKES BUT PRIDE.");
  while (true) {
    const cards = CardsCore.deck();
    const player = [cards.pop(), cards.pop(), cards.pop(), cards.pop(), cards.pop()];
    const joshua = [cards.pop(), cards.pop(), cards.pop(), cards.pop(), cards.pop()];
    term.print("");
    await term.type("YOUR HAND:  " + CardsCore.show(player));
    await term.type("NUMBER THE CARDS 1-5. TYPE DISCARD 1 3 5, OR KEEP.");
    while (true) {
      const t = norm(await term.read("> "));
      if (/^(quit|exit|stop)$/.test(t)) {
        await term.type("AS YOU WISH.");
        return;
      }
      if (/^(keep|stand|stay|none)$/.test(t)) break;
      const m = t.match(/^discard((?: [1-5])+)$/);
      if (m) {
        const idxs = [...new Set(m[1].trim().split(" ").map(Number))].sort((a, b) => b - a);
        for (const i of idxs) player.splice(i - 1, 1, cards.pop());
        await term.type("YOUR HAND:  " + CardsCore.show(player));
        break;
      }
      await term.type("DISCARD <NUMBERS> OR KEEP.");
    }
    for (const i of CardsCore.pokerDiscards(joshua).sort((a, b) => b - a)) {
      joshua.splice(i, 1, cards.pop());
    }
    const pr = CardsCore.pokerRank(player);
    const jr = CardsCore.pokerRank(joshua);
    await term.type("MY HAND:    " + CardsCore.show(joshua));
    await term.type(
      "YOU: " + CardsCore.RANK_NAMES[pr[0]] + ".  ME: " + CardsCore.RANK_NAMES[jr[0]] + "."
    );
    const d = CardsCore.compareRanks(pr, jr);
    if (d > 0) await term.type("YOU WIN.");
    else if (d < 0) await term.type("I WIN.");
    else await term.type("A TIE. THE HOUSE WOULD KEEP THE MONEY. THERE IS NO HOUSE.");
    state.gamesPlayed = (state.gamesPlayed || 0) + 1;
    const again = norm(await term.read("PLAY AGAIN? (YES/NO): "));
    if (!isYes(again)) return;
  }
}
