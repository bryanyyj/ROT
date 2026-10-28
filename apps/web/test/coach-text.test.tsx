import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoachText } from "../src/CoachText.js";

describe("coach response formatting", () => {
  it("renders the coach's headings, emphasis, paragraphs and lists", () => {
    const html = renderToStaticMarkup(<CoachText>{"## Current Assessment\n\n**Engine verdict: REST**\n\n### Thursday (Oct 29)\n\n- Swim: easy 30 min\n- Run: easy 20 min"}</CoachText>);
    expect(html).toContain("<h3>Current Assessment</h3>");
    expect(html).toContain("<strong>Engine verdict: REST</strong>");
    expect(html).toContain("<li>Swim: easy 30 min</li>");
    expect(html).not.toContain("##");
    expect(html).not.toContain("**");
  });
  it("handles partial streamed Markdown and makes tables scrollable", () => {
    expect(() => renderToStaticMarkup(<CoachText>{"## Execution\n\n**Pacing"}</CoachText>)).not.toThrow();
    const html = renderToStaticMarkup(<CoachText>{"| Day | Session |\n| --- | --- |\n| Monday | Swim |"}</CoachText>);
    expect(html).toContain('class="coach-table"');
    expect(html).toContain("<table>");
    const estimates = renderToStaticMarkup(<CoachText>{"ATL ~35 and TSB ~-12. ~~Removed~~"}</CoachText>);
    expect(estimates).toContain("ATL ~35 and TSB ~-12.");
    expect(estimates).toContain("<del>Removed</del>");
  });
  it("does not execute HTML, unsafe links or remote images from model output", () => {
    const html = renderToStaticMarkup(<CoachText>{'<script>alert(1)</script>\n\n[click](javascript:alert%281%29)\n\n![pixel](https://example.com/pixel.png)'}</CoachText>);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });
});
