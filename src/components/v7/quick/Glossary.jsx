/* Tap-to-explain terms. Plain English, one or two sentences each. Used by the
   Quick Survey and the hardest questions in the full survey. */
import React, { useId, useState } from "react";

export const GLOSSARY = {
  fee: { term: "Annual fee", text: "A yearly charge just for holding the card. Some cards charge $0; premium travel cards charge $95 to $895 and give back credits, points and perks to make up for it." },
  apr: { term: "APR (interest)", text: "The yearly interest rate on any balance you don't pay off. It is often 20% or more, so interest usually costs more than the rewards a card earns." },
  statement: { term: "Statement balance", text: "The total you owe on your monthly bill. Pay all of it by the due date and you are charged no interest at all." },
  transfer: { term: "Transfer partners", text: "Airlines and hotels you can move bank points to (Chase to United or Hyatt, for example). Points often go further this way than as cash." },
  rule524: { term: "5/24", text: "Chase usually says no if you opened 5 or more credit cards, from any bank, in the last 24 months. It is why the order you apply in matters." },
  score: { term: "Credit score bands", text: "Your score is a number from 300 to 850. Below 580 is poor, 580 to 669 is fair, 670 to 739 is good, 740 to 799 is very good, and 800 or more is excellent. Free apps and most banks show yours. We never check it." },
};

/** <Term k="apr">interest</Term> — a button that opens a short note right below. */
export default function Term({ k, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const g = GLOSSARY[k];
  if (!g) return <>{children}</>;
  return (
    <>
      <button type="button" className="gloss-term" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>{children || g.term}</button>
      {open && (
        <span id={id} className="gloss-note" role="note">
          <strong>{g.term}.</strong> {g.text}
        </span>
      )}
    </>
  );
}

/** A row of tap-to-explain terms placed after a paragraph: "What do these mean?" */
export function TermRow({ keys }) {
  return (
    <p className="gloss-row">
      <span>What do these mean?</span>
      {keys.map((k) => <Term key={k} k={k} />)}
    </p>
  );
}
