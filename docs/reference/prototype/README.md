# Prototype reference

`idea-atlas-agents.html` is the original working prototype (open it in a browser). `idea-atlas-agents.prototype.js` is its decoded application source: one React class component with the Three.js scene, layout math, agent choreography, prompts and local fallback inline. `AGENTS-SPEC.md` and `IMPLEMENTATION.md` are the product and design briefs that came with it.

The production app ports these piece by piece into `engine/`, `lib/` and `components/`. When the design spec and the prototype disagree, the prototype wins.
