const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const TOKEN = process.env.TOKEN;

// IDs
const CATEGORIA_WHITELIST = "1496029624088662049";
const CANAL_TRANSCRIPT = "1496155923457118459";
const CARGO_SEM_WL = "1496029518031224842";
const CARGO_APROVADO = "1496029516370415658";
const CARGO_STAFF = "1496123378220929094";
const CANAL_LOG_APROVACAO = "1499502969962496041";

// URL do seu Worker
const WORKER_URL = process.env.WORKER_URL || "https://transcripts-whitelist.henrique-brantmoura.workers.dev";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const perguntas = [
  "O que é RDM e por que ele é proibido no RP?",
  "Explique o que significa VDM e dê um exemplo.",
  "O que é combat logging (CL)?",
  "Conte sua história do RP:",
  "O que é considerado dark RP?",
  "O que caracteriza um fail RP?",
  "O que é metagaming? Cite uma situação onde isso acontece.",
  "O que significa ter amor à vida dentro do RP?",
  "Explique o que é cop bait.",
  "Você presencia um crime, mas viu isso em live/Discord e não dentro do jogo. Como você age?",
  "Seu personagem sofre um acidente grave. Como você deve agir em relação ao RP?",
  "Você e seus amigos querem fazer vários roubos seguidos rapidamente. Isso pode? Justifique.",
  "Você está sendo abordado por 2 policiais armados. O que você faz e por quê?"
];

function criarHTMLTranscript(channel, mensagensOrdenadas) {
  const htmlMsgs = mensagensOrdenadas.map(m => {
    const avatar = m.author.displayAvatarURL({ extension: "png" });
    const data = m.createdAt.toLocaleString("pt-BR");
    const conteudo = (m.content || "[sem texto]")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `
      <div class="msg">
        <img src="${avatar}" class="avatar">
        <div class="content">
          <div>
            <span class="author">${m.author.tag}</span>
            ${m.author.bot ? `<span class="bot">BOT</span>` : ""}
            <span class="date">${data}</span>
          </div>
          <div class="text">${conteudo}</div>
        </div>
      </div>`;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${channel.name}</title>
<style>
body {
  margin: 0;
  padding: 30px;
  background: #313338;
  color: #dbdee1;
  font-family: Arial, sans-serif;
}
.header {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
}
.icon {
  width: 88px;
  height: 88px;
  border-radius: 6px;
}
.title {
  font-size: 28px;
  color: white;
  font-weight: bold;
}
.subtitle, .count {
  font-size: 22px;
  color: white;
}
.msg {
  display: flex;
  gap: 12px;
  margin-bottom: 22px;
}
.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}
.author {
  font-weight: bold;
  color: white;
}
.bot {
  background: #5865f2;
  color: white;
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 4px;
  margin-left: 5px;
}
.date {
  color: #949ba4;
  font-size: 12px;
  margin-left: 6px;
}
.text {
  margin-top: 5px;
  white-space: pre-wrap;
  line-height: 1.4;
}
</style>
</head>
<body>

<div class="header">
  <img class="icon" src="${channel.guild.iconURL({ extension: "png" }) || ""}">
  <div>
    <div class="title">${channel.guild.name}</div>
    <div class="subtitle">${channel.name}</div>
    <div class="count">${mensagensOrdenadas.length} mensagens</div>
  </div>
</div>

${htmlMsgs}

</body>
</html>`;
}

async function enviarTranscript(channel, membroId = null) {
  try {
    const mensagens = await channel.messages.fetch({ limit: 100 });
    const mensagensOrdenadas = [...mensagens.values()].reverse();

    const html = criarHTMLTranscript(channel, mensagensOrdenadas);

    const resposta = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ html })
    });

    const data = await resposta.json();
    const link = data.url;

    const botao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("🌐 Ver Transcript")
        .setStyle(ButtonStyle.Link)
        .setURL(link)
    );

    const canalLogs = channel.guild.channels.cache.get(CANAL_TRANSCRIPT);

    if (canalLogs) {
      await canalLogs.send({
        content: `📄 Transcript do ticket: **${channel.name}**`,
        components: [botao]
      });
    }

    if (membroId) {
      const membro = await channel.guild.members.fetch(membroId).catch(() => null);

      if (membro) {
        await membro.send({
          content: `📄 Aqui está o transcript do seu ticket de whitelist: **${channel.name}**`,
          components: [botao]
        }).catch(() => {});
      }
    }

  } catch (err) {
    console.error("Erro transcript:", err);
  }
}

function fecharTicket(channel, membroId = null, tempo = 5000) {
  setTimeout(async () => {
    await enviarTranscript(channel, membroId);
    await channel.delete().catch(() => {});
  }, tempo);
}

client.on("channelCreate", async (channel) => {
  if (!channel.isTextBased()) return;
  if (channel.parentId !== CATEGORIA_WHITELIST) return;

  const btn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("iniciar")
      .setLabel("📋 Iniciar Whitelist")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    content: "Clique para iniciar sua whitelist.",
    components: [btn]
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const channel = interaction.channel;
  if (channel.parentId !== CATEGORIA_WHITELIST) return;

  if (interaction.customId === "iniciar") {
    await interaction.reply("Iniciando...");

    const userId = interaction.user.id;
    let etapa = 0;

    await channel.send(perguntas[0]);

    const collector = channel.createMessageCollector({
      filter: m => m.author.id === userId,
      time: 300000
    });

    collector.on("collect", async () => {
      etapa++;

      if (etapa < perguntas.length) {
        await channel.send(perguntas[etapa]);
      } else {
        collector.stop("ok");
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason !== "ok") {
        await channel.send("⏰ Tempo esgotado. Ticket será fechado.").catch(() => {});
        fecharTicket(channel, userId);
        return;
      }

      const staff = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`aprovar_${userId}`)
          .setLabel("✅ Aprovar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reprovar_${userId}`)
          .setLabel("❌ Reprovar")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send(`⏳ ${interaction.user}, aguarde um STAFF analisar.`);
      await channel.send({
        content: "📋 Painel da Staff:",
        components: [staff]
      });
    });
  }

  if (interaction.customId.startsWith("aprovar_")) {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão", ephemeral: true });
    }
  
    const id = interaction.customId.split("_")[1];
    const membro = await interaction.guild.members.fetch(id).catch(() => null);
  
    if (membro) {
      await membro.roles.add(CARGO_APROVADO).catch(console.error);
      await membro.roles.remove(CARGO_SEM_WL).catch(console.error);
    }
  
    // 📄 LOG DE APROVAÇÃO
    const canalLog = interaction.guild.channels.cache.get(CANAL_LOG_APROVACAO);
  
    if (canalLog) {
      await canalLog.send({
        content:
  `✅ **Whitelist Aprovada**
  
  👤 **Usuário:** <@${id}>
  🆔 **ID:** \`${id}\`
  
  🛡️ **Aprovado por:** <@${interaction.user.id}>
  🆔 **ID Staff:** \`${interaction.user.id}\`
  
  🎫 **Ticket:** ${channel.name}
  
  📌 Use esse ID para vincular com denúncias`
      });
    }
  
    // 💬 RESPOSTA BONITA
    await interaction.reply(
  `✅ **Whitelist aprovada!**
  
  Parabéns <@${id}>!  
  Você foi aprovado na whitelist da **Linha Paulista RP**.
  
  🚀 Seu acesso já foi liberado  
  🎮 Bom RP!`
    );
  
    fecharTicket(channel, id);
  }
  
  if (interaction.customId.startsWith("reprovar_")) {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão", ephemeral: true });
    }
  
    const id = interaction.customId.split("_")[1];
  
    await interaction.reply(
  `❌ **Whitelist reprovada**
  
  <@${id}>, você não passou na whitelist desta vez.
  
  Tente novamente com mais atenção às regras.`
    );
  
    fecharTicket(channel, id);
  }
});
client.on("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.login(TOKEN);