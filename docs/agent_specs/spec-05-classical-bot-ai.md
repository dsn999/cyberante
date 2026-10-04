# SPEC-05: Classical Game AI Engine (Solo Mode)

## 1. Context & Objective
Implement a local, deterministic classical game AI (strictly non-LLM) enabling judges to play instant full-featured matches offline without an online human partner.

## 2. Target Files
- `packages/client/src/ai/ClassicalBotAI.ts`
- `packages/client/src/ai/BotProfiles.ts`

## 3. Invariants & Rules
1. **Zero External API Calls:** 100% deterministic local TypeScript execution.
2. **Combinatorial Search:** Evaluates all 10 possible 3-card/2-card split partitions.
3. **Flux Optimization:** Simulates 1-step and 2-step rank nudges and suit shifts to maximize expected net damage.
4. **Three Bot Profiles:**
   - **Cipher-0:** Balanced tactical play.
   - **Vektor-Aggro:** Prioritizes Overcharge and offensive card burns.
   - **Aegis-Wall:** Maximizes shield mitigation and deploys Parry counters.
5. **Cadence Simulation:** Simulates 1.0–2.0s human decision delays with UI feedback.

## 4. Verification Command
Headless execution test simulating 500 complete hands without error.
