import React, { useState, useEffect } from 'react';
import './DHHMascot.css';

const TRIVIA = [
    "Seedhe Maut's 'Nanchaku' references an anime weapon and their explosive energy.",
    "KRSNA was one of the first Indian rappers to diss heavily in English back in the day.",
    "DIVINE's 'Gully Boy' loosely mirrors his actual come-up in Mumbai.",
    "MC Stan produced his entire 'Tadipaar' album by himself.",
    "Bohemia is widely considered the pioneer of Punjabi Rap.",
    "Talha Anjum and Talha Yunus started Young Stunners when they were just 16.",
    "Naezy's 'Aafat' was shot entirely on an iPad in his neighborhood.",
    "Prabh Deep's 'Class-Sikh' is heavily inspired by his life in Tilak Nagar, Delhi.",
    "Emiway Bantai's name is a combination of Eminem and Lil Wayne.",
    "Raftaar started his career as a dancer before moving into rap.",
    "Hanumankind's 'Big Dawgs' put Indian flow on the global map.",
    "Yashraj is known for bringing a very theatrical vocal performance to his tracks.",
    "Dhanji is pioneering the Gujarati hip-hop sound.",
    "Fotty Seven is known for his witty, purely Delhi-slang rap style.",
    "Karma is known as the 'Dehradun ka Ladka'.",
    "Calm from Seedhe Maut used to produce beats before he started rapping.",
    "Encore ABJ wrote a lot of his early verses while commuting in the Delhi Metro.",
    "Brodha V was mixing classical Indian elements with rapid-fire English rap years ago.",
    "Badshah used to be a part of the underground group Mafia Mundeer with Yo Yo Honey Singh.",
    "Ikka, Raftaar, and Lil Golu were all early associates before breaking out solo.",
    "Ahmer brings the harsh realities of Kashmir into his deep, introspective rap.",
    "Tienas brings a very unique jazz-hop and alternative rap sound to the Mumbai scene.",
    "Sikander Kahlon has arguably the largest discography in Indian underground hip-hop.",
    "Muhfaad is famous for his complex rhyme schemes and double entendres.",
    "Rebel 7 is a core member of the Delhi underground crew 'Aavrutti'.",
    "Bella won MTV Hustle Season 1 and dropped multiple full-length albums shortly after.",
    "King was a standout contestant on MTV Hustle before becoming a mainstream pop-rap sensation.",
    "Paradox broke onto the scene with a very experimental, genre-bending flow on Hustle 2.0.",
    "Yungsta is one of the earliest artists to put out consistent mixtapes in the Delhi scene.",
    "Sez on the Beat is often credited with architecting the modern sound of Desi Hip-Hop.",
    "Stan's 'Basti Ka Hasti' became a mainstream catchphrase in India.",
    "Faris Shafi is known for his unapologetic, politically charged rap from Pakistan.",
    "Chen-K often addresses societal taboos and moral issues in his tracks.",
    "Sunny Khan Durrani has a very melancholic, introspective style of alternative rap.",
    "Taimour Baig is often compared to a young Talha Anjum for his aggressive poetic style.",
    "KR$NA's 'Vyanjan' uses every consonant of the Hindi alphabet in alphabetical order.",
    "Aapka Jush is known for his uniquely weird, comedic approach to Indian hip-hop.",
    "Umer Anjum gained major traction after dissing major artists with an old-school flow.",
    "Rap Demon's 'Gaumaan' showed his versatility as both a singer and a hardcore spitter.",
    "Seedhe Maut's 'Bayaan' is considered a cult-classic debut album for Indian Hip-Hop.",
    "EPR is known for his lightning-fast chopper flow and heavily sociopolitical lyrics.",
    "MC Altaf represented the Dharavi hip-hop scene and was featured in the Gully Boy movie.",
    "Loka was one of the earliest rappers to bring the Miami drill/trap aesthetic to Mumbai.",
    "Harjas Harjaayi is known for his incredibly raw, unhinged delivery.",
    "Srushti Tawade blew up on MTV Hustle with her storytelling and comedic rap.",
    "Dee MC has been representing female emcees in the Indian hip-hop scene since the early 2010s.",
    "Siri combines Kannada, English, and Hindi in her multilingual flows.",
    "Swadesi's 'The Warli Revolt' brought attention to the Aarey forest conservation protests.",
    "Khaasiyat's underground ciphers are a cornerstone for battle rap in India.",
    "Spitfire wrote some of the most iconic verses for Ranveer Singh's character in Gully Boy.",
    "Yashraj's EP 'Takiya Kalaam' merges deep poetic verses with modern hip-hop production.",
    "Bantai Records was founded by Emiway to support and sign independent underground artists.",
    "Kalamkaar, co-founded by Raftaar and Ankit Khanna, became a powerhouse label for Desi Hip-Hop.",
    "Gravity won the Red Bull Spotlight competition with his unmatched lyrical complexity.",
    "Agnastik brings a heavy philosophical and mythological angle to his rap.",
    "Dakait Shady represents the raw Dehradun hip-hop scene alongside Karma.",
    "Naezy's unique 'Bombay 70' slang heavily influenced the modern Mumbai rap dialect.",
    "Dhanji's 'Ruab' album is praised for its incredibly unique production and jazz-rap elements.",
    "Rawal and Bharg's 'Sab Chahiye' was a breakthrough collaborative album for the Delhi scene.",
    "Sikander Kahlon drops a new mixtape every year on his birthday.",
    "Uday Bakshi is known for his incredibly fast and aggressive flow in the Delhi circuit.",
    "Nanku (formerly Udbhav) blends hip-hop with alternative R&B and indie pop.",
    "Karun's 'Qabool Hai' is often cited as one of the most emotional alternative rap albums in India.",
    "Qaab brought a distinct melodic trap wave to the Indian underground.",
    "J-Trix is known for his aggressive chopper flows and representing Kolkata hip-hop.",
    "EPR's band 'Underground Authority' was mixing rap and rock long before it was mainstream in India.",
    "Ahmer's 'Azli' album dives deep into the sociopolitical trauma and reality of Kashmir.",
    "Sos (Straight Outta Srinagar) is a duo bringing a very raw, drill-inspired sound from Kashmir.",
    "MC Square merged traditional Haryanvi folk music with hip-hop on MTV Hustle.",
    "Panther brought a powerful, commanding voice and heavy wordplay to the Hustle stage.",
    "Shloka is known for his ability to weave complex mythology into rapid-fire rap.",
    "Tienas' album 'O' is a highly experimental project mixing electronic, jazz, and rap.",
    "D'Evil is one of the most respected veteran lyricists in the Mumbai underground.",
    "Shah Rule brings a premium, international sounding mix and swagger to his tracks.",
    "MC Kode was instrumental in building the 'Spit Dope Inc' battle rap league in Delhi.",
    "Frappe Ash's 'Slambook' is a deeply personal, nostalgic trip through his life.",
    "Hanumankind's 'Go to Sleep' features a cinematic, high-octane music video shot in a boxing ring.",
    "Sammad is known for his eccentric, lo-fi, and heavily sample-based hip-hop sound.",
    "The Siege is praised for his deeply introspective and vulnerable songwriting.",
    "Prabh Deep's 'Tabia' is widely considered a masterpiece of conceptual Indian hip-hop.",
    "Mo Joshi and Uday Kapur co-founded Azadi Records to give a platform to marginalized voices in DHH.",
    "Faris Shafi's 'Introduction' was a massive viral hit for its brutally honest and comedic bars.",
    "Talha Yunus is known for his razor-sharp, rapid-fire flow compared to Anjum's poetic pacing.",
    "Chen-K's 'Asal Pahari' highlights the struggles and life in the mountainous regions of Pakistan.",
    "Shamoon Ismail created his own subgenre called 'Jutt Blues' merging Punjabi vocals with synth-wave hip-hop.",
    "Raftaar's 'Mr. Nair' album pays homage to his South Indian roots and Malayalam heritage.",
    "Badshah's '3:00 AM Sessions' EP proved he could spit hardcore bars alongside underground heavyweights.",
    "Ikka's 'I' album marked his return to pure hip-hop, featuring massive collabs with DIVINE and Raftaar.",
    "Lil Golu is credited with writing some of the biggest early hits for Yo Yo Honey Singh.",
    "Brodha V's 'Aathma Raama' was one of the first viral Indian hip-hop tracks mixing Sanskrit shlokas and English rap."
];

export default function DHHMascot() {
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [triviaIndex, setTriviaIndex] = useState(0);

    const showRandomFact = () => {
        setTriviaIndex(prev => {
            let nextIndex = prev;
            while (nextIndex === prev) {
                nextIndex = Math.floor(Math.random() * TRIVIA.length);
            }
            return nextIndex;
        });
        setBubbleVisible(true);
        setTimeout(() => setBubbleVisible(false), 5000);
    };

    useEffect(() => {
        const interval = setInterval(showRandomFact, 18000);
        return () => clearInterval(interval);
    }, []);

    const handleClick = () => {
        showRandomFact();
    };

    return (
        <div className="dhh-mascot-container">
            {bubbleVisible && (
                <div className="dhh-mascot-bubble fade-in">
                    <p>{TRIVIA[triviaIndex]}</p>
                </div>
            )}
            <div className="dhh-mascot" onClick={handleClick}>
                <img src="/mascot_clean.png" alt="DHH Mascot" />
            </div>
        </div>
    );
}
