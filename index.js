const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const axios = require("axios");

const TOKEN = process.env.TOKEN;

// IDs
const CATEGORIA_WHITELIST = "1496029624088662049";
const CANAL_TRANSCRIPT = "1496155923457118459";
const CARGO_APROVADO = "1496029516370415658";
const CARGO_STAFF = "1496029476231053363";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const perguntas = [
  "Qual seu nome real?",
  "Qual sua idade real?",
  "Já jogou RP antes?",
  "Conte sua história:",
  "Você leu as regras?"
];

// 🔥 TRANSCRIPT BONITO COM LINK
async function enviarTranscript(channel, membroId = null) {
  try {
    const mensagens = await channel.messages.fetch({ limit: 100 });
    const msgs = [...mensagens.values()].reverse();

    const htmlMsgs = msgs.map(m => {
      const avatar = m.author.displayAvatarURL({ extension: "png" });
      const data = m.createdAt.toLocaleString("pt-BR");
      const conteudo = (m.content || "[sem texto]")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      return `
      <div class="msg">
        <img src="${avatar}" class="avatar">
        <div>
          <div>
            <span class="author">${m.author.tag}</span>
            <span class="date">${data}</span>
          </div>
          <div class="text">${conteudo}</div>
        </div>
      </div>`;
    }).join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${channel.name}</title>
<style>
body {
  margin: 0;
  padding: 25px;
  background: #313338;
  color: #dbdee1;
  font-family: Arial;
}
.header {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
}
.icon {
  width: 80px;
  height: 80px;
}
.title {
  font-size: 26px;
  color: white;
}
.subtitle {
  font-size: 22px;
}
.msg {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
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
.date {
  color: #949ba4;
  font-size: 12px;
  margin-left: 6px;
}
.text {
  margin-top: 4px;
  white-space: pre-wrap;
}
</style>
</head>
<body>

<div class="header">
  <img class="icon" src="${channel.guild.iconURL() || ""}">
  <div>
    <div class="title">${channel.guild.name}</div>
    <div class="subtitle">${channel.name}</div>
    <div>${msgs.length} mensagens</div>
  </div>
</div>

${htmlMsgs}

</body>
</html>`;

    const res = await axios.post("https://paste.rs", html, {
      headers: { "Content-Type": "text/html" }
    });

    const link = res.data.trim();

    const canalLogs = channel.guild.channels.cache.get(CANAL_TRANSCRIPT);

    if (canalLogs) {
      await canalLogs.send(`📄 Transcript: **${channel.name}**\n🔗 ${link}`);
    }

    if (membroId) {
      const membro = await channel.guild.members.fetch(membroId).catch(() => null);

      if (membro) {
        await membro.send(`📄 Seu transcript:\n🔗 ${link}`).catch(() => {});
      }
    }

  } catch (err) {
    console.error(err);
  }
}

// 🔒 FECHAR
function fecharTicket(channel, membroId = null, tempo = 5000) {
  setTimeout(async () => {
    await enviarTranscript(channel, membroId);
    await channel.delete().catch(() => {});
  }, tempo);
}

// 📥 CRIAR BOTÃO
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

// 🎯 INTERAÇÕES
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const channel = interaction.channel;
  if (channel.parentId !== CATEGORIA_WHITELIST) return;

  if (interaction.customId === "iniciar") {
    await interaction.reply("Iniciando...");

    const userId = interaction.user.id;
    let respostas = [];
    let etapa = 0;

    await channel.send(perguntas[0]);

    const collector = channel.createMessageCollector({
      filter: m => m.author.id === userId,
      time: 300000
    });

    collector.on("collect", async (msg) => {
      respostas.push(msg.content);
      etapa++;

      if (etapa < perguntas.length) {
        await channel.send(perguntas[etapa]);
      } else {
        collector.stop("ok");
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason !== "ok") {
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
      await channel.send({ components: [staff] });
    });
  }

  if (interaction.customId.startsWith("aprovar_")) {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão", ephemeral: true });
    }

    const id = interaction.customId.split("_")[1];
    const membro = await interaction.guild.members.fetch(id).catch(() => null);

    if (membro) await membro.roles.add(CARGO_APROVADO);

    await interaction.reply("✅ Aprovado!");
    fecharTicket(channel, id);
  }

  if (interaction.customId.startsWith("reprovar_")) {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão", ephemeral: true });
    }

    const id = interaction.customId.split("_")[1];

    await interaction.reply("❌ Reprovado!");
    fecharTicket(channel, id);
  }
});

client.on("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.login(TOKEN);