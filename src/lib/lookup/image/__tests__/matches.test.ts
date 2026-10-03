import { describe, expect, it } from "vitest";
import { assessStolen, domainOf, groupMatches, profileIdentity } from "../matches";
import { isPrivateIp } from "../ip";

const m = (url: string, title = url) => ({ url, title, date: null });

describe("groupMatches", () => {
  it("groups by domain, profile sites first, dedupes URLs", () => {
    const groups = groupMatches([
      m("https://blog.example.com/a"),
      m("https://www.instagram.com/ada/"),
      m("https://blog.example.com/b"),
      m("https://blog.example.com/a"),
      m("javascript:alert(1)"),
    ]);
    expect(groups.map((g) => g.domain)).toEqual(["instagram.com", "blog.example.com"]);
    expect(groups[1].matches).toHaveLength(2);
  });
});

describe("profileIdentity", () => {
  it("extracts the name part of profile titles", () => {
    expect(profileIdentity("Ada Obi (@ada.o) • Instagram photos and videos")).toBe("ada obi");
    expect(profileIdentity("Chidi Lagos | Facebook")).toBe("chidi lagos");
  });
});

describe("assessStolen", () => {
  it("flags the same photo on different named profiles", () => {
    const r = assessStolen(
      groupMatches([
        m("https://instagram.com/a", "Ada Obi (@ada) • Instagram photos"),
        m("https://facebook.com/b", "Kemi Bello | Facebook"),
      ]),
    );
    expect(r.flag).toBe(true);
    expect(r.reason).toMatch(/2 different profiles/);
  });
  it("flags spread across many sites incl. a profile site", () => {
    const r = assessStolen(groupMatches([m("https://instagram.com/a", "x"), m("https://a.com/1"), m("https://b.com/2")]));
    expect(r.flag).toBe(true);
  });
  it("does not flag a single profile or product pages only", () => {
    expect(assessStolen(groupMatches([m("https://instagram.com/a", "Ada (@ada) • Instagram")])).flag).toBe(false);
    expect(assessStolen(groupMatches([m("https://jumia.com.ng/p"), m("https://konga.com/p"), m("https://apple.com/p")])).flag).toBe(false);
  });
});

describe("domainOf", () => {
  it("normalises hostnames", () => {
    expect(domainOf("https://m.facebook.com/x")).toBe("facebook.com");
    expect(domainOf("ftp://x.com")).toBeNull();
  });
});

describe("isPrivateIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s", (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "102.89.1.1", "2606:4700::1111"])("allows %s", (ip) => expect(isPrivateIp(ip)).toBe(false));
});
