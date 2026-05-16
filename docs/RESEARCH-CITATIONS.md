# Research citations (#88)

Every analytical claim DYAD surfaces is grounded in a specific published
finding. This file is the catalogue. The Atlas view footer links here
("Metrics grounded in Gottman Institute research").

## Bid response + relationship stability

> **86% bid response rate predicts stability; 33% predicts dissolution.**

Gottman, J. M. (2011). *The Science of Trust: Emotional Attunement for
Couples.* W. W. Norton & Company. Chapter 3 ("Sliding-Door Moments").

Source for `gottman_status` thresholds in
`packages/engine/src/state/relationship-model-updater.ts`.

## Gottman's 91 % divorce prediction

> Marriages with sustained negative-affect imbalance during conflict
> were correctly predicted to divorce 91 % of the time.

Gottman, J. M., & Levenson, R. W. (1992). *Marital processes predictive
of later dissolution: Behavior, physiology, and health.* Journal of
Personality and Social Psychology, **63**(2), 221–233. <https://doi.org/10.1037/0022-3514.63.2.221>

The widely cited figure originates here. DYAD does not claim to
reproduce 91 %; it surfaces the same observable behaviours that drove
that prediction.

## The 5:1 magic ratio

> Stable couples maintain at least a 5:1 ratio of positive to negative
> interactions during conflict.

Gottman, J. M. (1994). *What Predicts Divorce? The Relationship Between
Marital Processes and Marital Outcomes.* Lawrence Erlbaum Associates.

Source for `five_to_one_ratio` in `RelationshipModel`.

## The Four Horsemen

> Criticism, contempt, defensiveness, and stonewalling are the four
> communication patterns most predictive of dissolution.

Gottman, J. M., & Silver, N. (1999). *The Seven Principles for Making
Marriage Work.* Three Rivers Press.

Source for `horseman_markers` in `FeatureVector`.

## Primary vs secondary emotion

> Surface emotions (anger, contempt) often mask more vulnerable primary
> emotions (hurt, fear, shame, loneliness).

Greenberg, L. S. (2002). *Emotion-Focused Therapy: Coaching Clients to
Work Through Their Feelings.* American Psychological Association.

Johnson, S. M. (2008). *Hold Me Tight: Seven Conversations for a Lifetime
of Love.* Little, Brown Spark.

Source for `PrimarySecondaryDetector` and the secondary-emotion prompt
few-shots in `packages/engine/src/detectors/secondary-emotion-prompt.ts`.

## Function words reveal psychological state

> Function-word usage (pronouns, articles, prepositions) reveals
> psychological state more reliably than content words.

Pennebaker, J. W., Mehl, M. R., & Niederhoffer, K. G. (2003). *Psychological
aspects of natural language use: Our words, our selves.* Annual Review
of Psychology, **54**, 547–577. <https://doi.org/10.1146/annurev.psych.54.101601.145041>

Source for `FunctionWordParser` (`fw_i`, `fw_we`, `fw_you`, `fw_third`, …).

## Attachment & responsiveness

> Perceived partner responsiveness mediates intimacy and is foundational
> to attachment security.

Reis, H. T., & Shaver, P. (1988). *Intimacy as an interpersonal process.*
In *Handbook of Personal Relationships* (pp. 367–389). John Wiley &
Sons.

Source for `attachment_inference` heuristics in the model updaters.

## NRC Emotion Lexicon

Mohammad, S. M., & Turney, P. D. (2013). *Crowdsourcing a word-emotion
association lexicon.* Computational Intelligence, **29**(3), 436–465.
<https://doi.org/10.1111/j.1467-8640.2012.00460.x>

Source for `packages/lexicons/src/nrc-emotion-lexicon.json` (curated
subset of ~572 high-frequency interpersonal terms).

## AFINN

Nielsen, F. Å. (2011). *A new ANEW: Evaluation of a word list for
sentiment analysis in microblogs.* Proceedings of the ESWC2011 Workshop
on 'Making Sense of Microposts'.

Source for `packages/lexicons/src/afinn-111.json` and `afinn_valence`
in `FeatureVector`.

## Action identification

Vallacher, R. R., & Wegner, D. M. (1987). *What do people think they're
doing? Action identification and human behavior.* Psychological Review,
**94**(1), 3–15. <https://doi.org/10.1037/0033-295X.94.1.3>

Source for `action_id_level` in `FeatureVector` and
`action_id_asymmetry` in `SelfModel`.

## Self-discrepancy theory (Higgins)

Higgins, E. T. (1987). *Self-discrepancy: A theory relating self and
affect.* Psychological Review, **94**(3), 319–340.

Source for `higgins_family` (`dejection` / `agitation` / `neutral`) in
`FeatureVector`.

---

For a 60-second demo prep pitch on the core research, the team should
be able to articulate the three load-bearing claims:

1. **Gottman 91 %** — bid response + 5:1 ratio + four horsemen predict
   relationship outcome with surprising accuracy.
2. **Pennebaker** — function words reveal psychological state; we can
   measure them without an LLM.
3. **EFT (Greenberg / Johnson)** — surface emotion is rarely the whole
   story; naming the softer feeling underneath changes the conversation.
