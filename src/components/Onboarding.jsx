/* ============================================================================
   Onboarding.jsx — v3.2 wrapper around the new sectioned SurveyFlow.
   ----------------------------------------------------------------------------
   The original single-question flow is now `onboarding/SurveyFlow.jsx`. This
   shim exists so App.jsx and any external caller keeps the same import path
   while the underlying experience evolves.
   ========================================================================== */

export { default } from "./onboarding/SurveyFlow.jsx";
