---
title: "[Teste de ciclo] Validacao da publicacao automatica"
description: "Post de teste para validar o ciclo completo de publicacao."
pubDate: 2026-06-22
project: "mcp-fiscal-brasil"
tags: ["teste", "ciclo", "automacao", "newsletter"]
draft: false
---

Este post foi criado para validar o ciclo completo de publicação da newsletter DeHor.

O objetivo é confirmar que, ao fazer push de um post com `draft: false` na branch `main`, a Action `send-newsletter` detecta o arquivo novo, cria um broadcast no Resend e envia o e-mail para os inscritos da audience fiscal.

Se você recebeu este e-mail, o ciclo está funcionando de ponta a ponta.

---

*Este post será removido após a validação.*
