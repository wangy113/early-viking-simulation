# Content review packet for a subject expert

This packet lists every factual claim the Gokstad Ship Explorer makes to students. Please check each one. The app is at https://wangy113.github.io/early-viking-simulation/ and every stop also appears in its Text version.

## How to review

- **Status** says how sure we are now. *Verified* means it matches at least two sources we checked. *Check* means one source only, sources disagree, or it is our wording of a general point.
- **Tag** is the evidence label students see on the stop: *Found* (found with this ship), *Other* (known from other finds), *Recon* (reconstruction).
- Mark each row Agree, Change or Remove, and add a note or a better source. Stop text lives in `src/content/stops.json`, so changes are easy to make.

## Stops

| # | Claim as students read it | Tag | Status | Notes and sources |
|---|---|---|---|---|
| 1 | Each side of the hull has 16 oak planks (strakes). | Found | Verified | Nicolaysen 1882. Wikipedia, Gokstad ship. |
| 1 | Each plank overlaps the one below and is fixed with iron rivets. This is clinker building. | Found | Verified | Rivets clinched over iron roves. Encyclopaedia Romana. |
| 1 | Builders shaped the planks first and fitted the frames afterward, so the hull is light and flexible. | Found | Check | A general point about shell-first Scandinavian building. Please confirm it suits Gokstad. We do not say how frames were fastened to strakes. |
| 1 | The shipwright hammers a rivet over a small iron plate on the inside. | Found | Check | Shows riveting from outside. A second person would usually hold the rove inside. Is the action acceptable as shown? |
| 2 | Seams were packed with wool or animal hair soaked in tar. | Other | Verified | Twisted wool or cow hair with pine tar. Encyclopaedia Romana. Tagged Other because the tar pot and the work are illustrated. |
| 3 | 16 round oar ports on each side, enough for 32 rowers. | Found | Verified | Nicolaysen 1882. Wikipedia. |
| 3 | The ports are cut through the third plank down from the top. | Found | Verified | Encyclopaedia Romana. Counting methods differ between sources, so please confirm. |
| 3 | The ports could be closed when the ship was under sail. | Found | Check | Wooden covers that swivel shut are described in one source we found. Please confirm or point us to a better one. |
| 3 | Some oars are stowed on posts in the middle of the ship. | Found | Check | Oars were found with the ship. How they were stowed in the scene is our choice. |
| 4 | Yellow and black shields were found fixed overlapping along the rail, 32 on each side. | Found | Verified | Nicolaysen 1882. Wikipedia. |
| 4 | Here they hang on the back half only. | Recon | Teaching choice | Deliberate, so students can compare open and covered oar ports. The text says so. |
| 4 | Historians think a row like this was for show, in harbor or at the burial. It covers the oar ports, so the crew could not row with shields in place. | Recon | Check | Widely stated. Some sources link two shields per oar port to a doubled crew. |
| 5 | A large rudder on the right side near the stern. This side was the steering board, the origin of *starboard*. | Found | Verified | Wikipedia. Oxford English Dictionary on *starboard*. |
| 6 | An oak mast fish at deck level held the mast and let the crew lower it. | Found | Verified | Nicolaysen 1882. |
| 6 | White wool cloth with sewn red stripes, found in the mound, may come from the sail. Size and pattern shown are a reconstruction. | Found, Recon | Verified | Nicolaysen 1882. The sail's size is unknown. |
| 7 | No fixed rowing benches were found. Many historians think each rower sat on his own sea chest. This is still debated. | Recon | Verified | Sources agree there were no thwarts. Chests, loose benches or sitting on the deck are all proposed. |
| 8 | A gaming board with horn playing pieces was buried with the ship. | Found | Verified | Nicolaysen 1882. Wikipedia, Gokstad Mound. |
| 8 | Games such as *hnefatafl* pitted a king and his defenders against attackers. | Other | Verified | Known from other finds and later texts. We do not claim the Gokstad board was for hnefatafl. |
| 9 | Kitchen equipment was among the grave goods. | Found | Verified | Wikipedia, Gokstad Mound. We avoid the word cauldron. |
| 9 | Her apron dress and pair of oval brooches follow women's graves across the Viking Age. | Other | Verified | See `docs/people-research.md` for clothing sources. |
| 10 | Parts of a tent were found. A wooden frame held a woolen cover that could be taken down. The cloth shown is a reconstruction. | Found, Recon | Check | Tent frame parts are well known. Please confirm the cover was wool. |
| 11 | Bones of twelve horses and several dogs were buried with the ship, with birds including peacocks. | Found | Verified | Wikipedia lists 12 horses, 8 dogs, 2 goshawks and 2 peacocks. Some sources give 6 dogs, so the text says several. |
| 11 | These animals showed the wealth and rank of the man buried here. | Recon | Verified | A common reading. Archaeology magazine, 2014. |
| 12 | The mound held three small boats. A boat like this could ferry people and goods or be used for fishing. | Found | Verified | Nicolaysen 1882. The uses are our suggestion. |

## About page and welcome text

| Claim | Status | Notes |
|---|---|---|
| Excavated in 1880 by a team led by Nicolay Nicolaysen, at Gokstad farm near Sandefjord. | Verified | Nicolaysen 1882. |
| About 23 meters long and 5 meters wide. | Verified | Sources give 23.2 to 23.8 m and about 5.2 m. |
| Tree rings show it was built around 890. A few years later a man was buried in a chamber on board. | Verified | Dendrochronology dates the burial chamber to about 901 to 905. |
| Grave goods included a gaming board, kitchen equipment, a tent, a sledge, beds, three small boats and the bones of horses, dogs and birds. | Verified | Wikipedia, Gokstad Mound. |
| The mound had been robbed long ago, which may explain why few weapons were found. | Verified | Widely reported. |
| In 1893 the replica *Viking* sailed from Bergen across the Atlantic in 27 days to Chicago. | Verified | Wikipedia, Viking (replica). |
| The original ship is preserved in Oslo. | Check | It is in the Museum of Cultural History collection. The Viking Ship Museum building is closed for rebuilding. Please confirm how to say this. |

## What the scene shows without saying it

Students may read the scene as evidence even where the text says nothing. Please look at these:

- **People.** Faces, bodies and hair are generic 3D models. Clothing follows `docs/people-research.md`, which grades each choice. The welcome text and About page say the people are illustrations.
- **Sea chests on deck.** Shown as rowing seats, matching stop 7. Their size and shape are a reconstruction.
- **The beach camp.** We imagine the ship being readied on a beach. This is a scene, not a known event.
- **The sail's red and white stripes** and its size.
- **The tiller and rudder fittings**, the rope rigging and the yard.
- **The small boat** is built in the same clinker style as the ship, scaled down.
- **The fjord, hills and spruce woods** are a general Norwegian coast, not the real landscape of Gokstad.

## Deliberately left out

We do not show or claim these without a source: how strakes were fastened to frames, a dragon head on the stems, a gangplank, a cauldron, an exact keel length, or the ship's draft. If you can point us to good sources for any of them, we can add them.

## Questions for the reviewer

1. Is "about 900" the right date in the title, given building about 890 and burial about 901 to 905?
2. Should stop 3 keep "could be closed under sail"?
3. Is the shipwright's riveting action acceptable, or should a second person hold the rove inside?
4. Is the wording "the original ship is preserved in Oslo" right today?
5. Is there anything in the scene a student is likely to take as a fact that is not?

## Sources we used

- Nicolaysen, N. *Langskibet fra Gokstad ved Sandefjord* (The Viking ship discovered at Gokstad in Norway). Kristiania, 1882. https://runeberg.org/gokstad/
- Gokstad ship, and Gokstad Mound. Wikipedia. https://en.wikipedia.org/wiki/Gokstad_ship and https://en.wikipedia.org/wiki/Gokstad_Mound
- The Gokstad ship. Encyclopaedia Romana, University of Chicago. https://penelope.uchicago.edu/~grout/encyclopaedia_romana/britannia/anglo-saxon/maldon/gokstad.html
- Revisiting the Gokstad. Archaeology magazine, July and August 2014. https://archaeology.org/issues/july-august-2014/features/revisiting-the-gokstad/
- Viking (replica Viking longship). Wikipedia. https://en.wikipedia.org/wiki/Viking_(replica_Viking_longship)

Better scholarly sources to consider: the Museum of Cultural History, University of Oslo, publications on the Gokstad find, and Arne Emil Christensen's work on Viking ship construction.
