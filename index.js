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

async function enviarTranscript(channel, membroId = null) {
  try {
    const canalLogs = channel.guild.channels.cache.get(CANAL_TRANSCRIPT);
    const mensagens = await channel.messages.fetch({ limit: 100 });

    const mensagensOrdenadas = [...mensagens.values()].reverse();

    const htmlMensagens = mensagensOrdenadas.map(m => {
      const avatar = m.author.displayAvatarURL({ extension: "png" });
      const data = m.createdAt.toLocaleString("pt-BR");
      const conteudo = m.content || "[sem texto]";

      return `
        <div class="message">
          <img src="${avatar}" class="avatar">
          <div class="content">
            <div>
              <span class="author">${m.author.tag}</span>
              <span class="date">${data}</span>
            </div>
            <div class="text">${conteudo}</div>
          </div>
        </div>
      `;
    }).join("");

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Transcript - ${channel.name}</title>
<style>
  body {
    background: #313338;
    color: #dbdee1;
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 25px;
  }

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 25px;
    border-bottom: 1px solid #4e5058;
    padding-bottom: 15px;
  }

  .server-icon {
    width: 70px;
    height: 70px;
    border-radius: 12px;
    margin-right: 15px;
  }

  .title {
    font-size: 26px;
    font-weight: bold;
    color: #ffffff;
  }

  .subtitle {
    font-size: 18px;
    color: #b5bac1;
  }

  .message {
    display: flex;
    margin-bottom: 18px;
  }

  .avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    margin-right: 12px;
  }

  .author {
    color: #ffffff;
    font-weight: bold;
    font-size: 15px;
  }

  .date {
    color: #949ba4;
    font-size: 12px;
    margin-left: 8px;
  }

  .text {
    margin-top: 4px;
    white-space: pre-wrap;
    line-height: 1.4;
  }

  .footer {
    margin-top: 30px;
    color: #949ba4;
    font-size: 13px;
    border-top: 1px solid #4e5058;
    padding-top: 15px;
  }
</style>
</head>
<body>

<div class="header">
  <img class="server-icon" src="${channel.guild.iconURL({ extension: "png" }) || ""}">
  <div>
    <div class="title">${channel.guild.name}</div>
    <div class="subtitle">#${channel.name}</div>
    <div class="subtitle">${mensagensOrdenadas.length} mensagens</div>
  </div>
</div>

${htmlMensagens}

<div class="footer">
  Transcript gerado automaticamente pelo sistema de whitelist.
</div>

</body>
</html>
`;

    const buffer = Buffer.from(html, "utf-8");

    const arquivo = {
      attachment: buffer,
      name: `${channel.name}-transcript.html`
    };

    if (canalLogs) {
      await canalLogs.send({
        content: `📄 Transcript do ticket: **${channel.name}**`,
        files: [arquivo]
      });
    }

    if (membroId) {
      const membro = await channel.guild.members.fetch(membroId).catch(() => null);

      if (membro) {
        await membro.send({
          content: `📄 Aqui está o transcript do seu ticket de whitelist: **${channel.name}**`,
          files: [arquivo]
        }).catch(() => {
          console.log("Não consegui enviar DM para o usuário.");
        });
      }
    }

  } catch (err) {
    console.error("Erro transcript:", err);
  }
}

function fecharTicket(channel, membroId = null, tempo = 5000) {
  setTimeout(async () => {
    try {
      await enviarTranscript(channel, membroId);
      await channel.delete("Ticket finalizado");
    } catch (err) {
      console.error("Erro ao fechar:", err);
    }
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
  }).catch(console.error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const channel = interaction.channel;
  if (channel.parentId !== CATEGORIA_WHITELIST) return;

  if (interaction.customId === "iniciar") {
    await interaction.reply("Iniciando...");

    const usuarioId = interaction.user.id;
    const respostas = [];
    let etapa = 0;

    await channel.send(perguntas[0]);

    const collector = channel.createMessageCollector({
      filter: m => m.author.id === usuarioId,
      time: 300000
    });

    collector.on("collect", async (msg) => {
      respostas.push(msg.content);
      etapa++;

      if (etapa < perguntas.length) {
        await channel.send(perguntas[etapa]);
      } else {
        collector.stop("finalizado");
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason !== "finalizado") {
        await channel.send("⏰ Tempo esgotado. Ticket será fechado.").catch(() => {});
        fecharTicket(channel, usuarioId);
        return;
      }

      const staffBtns = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`aprovar_${usuarioId}`)
          .setLabel("✅ Aprovar")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`reprovar_${usuarioId}`)
          .setLabel("❌ Reprovar")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send(`⏳ ${interaction.user}, aguarde um STAFF analisar suas respostas.`);

      await channel.send({
        content: "📋 Painel da Staff:",
        components: [staffBtns]
      });
    });
  }

  if (interaction.customId.startsWith("aprovar_")) {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });
    }

    const usuarioId = interaction.customId.replace("aprovar_", "");
    const membro = await interaction.guild.members.fetch(usuarioId).catch(() => null);

    if (membro) {
      await membro.roles.add(CARGO_APROVADO).catch(console.error);
    }

    await interaction.reply("✅ Aprovado! Ticket será fechado.");
    fecharTicket(channel, usuarioId);
  }

  if (interaction.customId.startsWith("reprovar_")) {
    if (!interaction.member.roles.cache.has(CARGO_STAFF)) {
      return interaction.reply({ content: "Sem permissão.", ephemeral: true });
    }

    const usuarioId = interaction.customId.replace("reprovar_", "");

    await interaction.reply("❌ Reprovado! Ticket será fechado.");
    fecharTicket(channel, usuarioId);
  }
});

client.on("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.login(TOKEN);