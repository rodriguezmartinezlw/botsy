# ADR-001 — API de voz para el check-in conversacional

**Estado:** Aceptada · **Fecha:** 2026-07-15 · **Decide:** Dirección técnica (Fable) · **Responde a:** "¿usar GPT live (OpenAI Realtime) u otra API para la voz?"

## Contexto

El núcleo de Botsy es un check-in diario por voz de ~5 minutos (RF-CV-01: full-duplex, <1,5 s por turno). Restricciones que condicionan la elección:

1. **Economía unitaria.** Suscripción de $29/mes. Un usuario activo genera ~150 min de voz/mes (5 min × 30 días). El coste de voz no debería superar ~20% del ARPU (~$6/mes/usuario) para dejar margen a LLM de extracción, infra y CAC.
2. **Extracción estructurada en vivo.** Durante la conversación hay que ejecutar tools (registrar observación, marcar toma, señal de alarma) — se necesita function calling nativo en el canal de voz.
3. **Biomarcadores vocales (F3).** Necesitaremos el audio crudo del paciente. Esto NO depende del proveedor de conversación: se graba en el cliente (MediaRecorder) con consentimiento y se procesa en nuestra infra.
4. **RGPD.** Voz = dato biométrico + de salud. Consentimiento granular, minimización, y revisar DPA/residencia UE del proveedor elegido.
5. **Velocidad de reconstrucción.** Proyecto en fase de rebuild con un solo equipo; menos infra propia = mejor.

## Opciones evaluadas (precios verificados 2026-07-15)

| Opción | Coste/min aprox. | Coste/usuario/mes (150 min) | Latencia/UX | Ingeniería | Notas |
|---|---|---|---|---|---|
| **A. OpenAI Realtime — `gpt-realtime-2.1`** | $0.06–0.11 (con prompt caching) | $9–16 | ~410 ms, barge-in excelente | Baja (WebRTC directo desde navegador, tokens efímeros) | $32/$64 por 1M tokens audio in/out |
| **A'. OpenAI Realtime — `gpt-realtime-2.1-mini`** | $0.02–0.05 | **$3–7.5** | Igual arquitectura; calidad de voz/razonamiento algo menor | Baja | $10/$20 por 1M tokens audio; ~⅓ del flagship |
| **B. ElevenLabs Agents** | $0.08 + LLM aparte (+ plan base) | $12–15+ | Muy buena; voces excelentes | Baja-media | Ya conocido por el equipo (Bupy). Caro para uso diario intensivo |
| **C. Gemini Live API** | $0.015–0.02 | $2.5–3 | ~380 ms, buena | **Media-alta**: solo WebSocket → requiere servidor de medios (LiveKit/Pipecat) entre navegador y API | El más barato gestionado |
| **D. Pipeline propio (Pipecat/LiveKit + STT + LLM + TTS)** | $0.03–0.05 + servidor | $4.5–7.5 + infra | Buena (~440 ms) pero turn-taking a nuestro cargo | **Alta**: servidor de medios propio, orquestación, mantenimiento | Máximo control y portabilidad de proveedor |

## Decisión

**Opción A' para F1: OpenAI Realtime API con `gpt-realtime-2.1-mini` por defecto, vía WebRTC con tokens efímeros**, con estas salvaguardas de diseño:

1. **Abstracción `VoiceSession`** (`src/lib/voz/`): la UI y la lógica de check-in no conocen al proveedor. Migrar a Gemini Live o a un pipeline Pipecat debe ser cambiar una implementación, no reescribir el producto.
2. **Modelo configurable por env** (`OPENAI_REALTIME_MODEL`): permite subir a `gpt-realtime-2.1` para demos/pilotos clínicos y volver a mini en producción.
3. **Grabación de audio en el cliente desde el día 1** (con consentimiento específico `voz_grabacion`), independiente del proveedor → el camino a biomarcadores (F3) queda abierto sin re-arquitectura.
4. **Control de coste:** límite duro de duración de sesión (~8 min), instrucciones del agente estables para maximizar prompt caching (input cacheado baja a ~$0.30–0.40/1M), y modo texto (coste ~despreciable) siempre disponible como alternativa.
5. **La extracción fina y la reconciliación** se hacen post-sesión sobre el transcript con un modelo de texto económico — no pagamos razonamiento profundo por el canal de audio.

### Por qué no las otras (hoy)

- **B (ElevenLabs):** $0.08/min + LLM aparte rompe la economía unitaria en uso diario (~50%+ del ARPU). Excelente para voz de marca, no para 150 min/mes/usuario.
- **C (Gemini Live):** el coste es imbatible, pero exige montar y operar un servidor de medios (WebSocket-only). Es el **plan B natural a escala**: cuando el gasto de voz supere de forma sostenida el 20% del ARPU o >~2.000 usuarios activos, evaluar migración detrás de la abstracción `VoiceSession`.
- **D (pipeline propio):** máximo control y el mejor acceso al audio para biomarcadores, pero es la opción con más ingeniería y mantenimiento; prematura para un rebuild en solitario. Reevaluar en F3 si los biomarcadores exigen streaming de audio a infra propia de todos modos.

## Consecuencias

- Dependencia de OpenAI en F1 (mitigada por la abstracción y el plan B documentado).
- Pendiente de diligencia antes de pacientes reales: DPA de OpenAI, retención cero de audio, residencia de datos UE (dato biométrico + salud, art. 9 RGPD).
- El modo texto usa el mismo builder de instrucciones y las mismas tools (una sola lógica de conversación, dos transportes).

## Disparadores de revisión de este ADR

- Coste de voz sostenido >20% del ARPU → evaluar C (Gemini Live + LiveKit/Pipecat).
- Calidad conversacional de mini insuficiente en pruebas con usuarios reales en es-ES → subir a `gpt-realtime-2.1` y re-hacer números.
- F3 biomarcadores requiere streaming a infra propia → reevaluar D.

## Fuentes

- [OpenAI Realtime API Pricing: Realtime-2.1 Costs](https://aireiter.com/blog/openai-realtime-api-pricing)
- [OpenAI Realtime API Pricing in 2026: Real-World Data From 4,000 Measured Sessions](https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions)
- [Pricing | OpenAI API](https://developers.openai.com/api/docs/pricing)
- [ElevenAgents Pricing](https://elevenlabs.io/pricing/agents) · [How much does ElevenAgents cost?](https://help.elevenlabs.io/hc/en-us/articles/29298065878929-How-much-does-ElevenAgents-cost)
- [OpenAI Realtime API vs Gemini Live vs Pipecat](https://vadimall.com/posts/openai-realtime-vs-gemini-live-vs-pipecat-voice-ai-typescript)
- [Realtime Voice AI APIs Compared (2026)](https://apiscout.dev/guides/realtime-voice-ai-apis-comparison-2026)
- [Best API for building a speech-to-speech voice agent in 2026](https://www.assemblyai.com/blog/best-speech-to-speech-voice-agent-api)
