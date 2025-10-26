import Head from 'next/head';

export default function Whitepaper() {
    return (
        <>
            <Head>
                <title>VRE Whitepaper | Virtual Reality Economics</title>
                <link rel="icon" href="/favicon.png" />
                <link rel="apple-touch-icon" href="/favicon.png" />
                <link rel="shortcut icon" href="/favicon.png" />
            </Head>
            <div className="w-full h-screen bg-black">
                <iframe
                    src="/VRE-Whitepaper.pdf"
                    className="w-full h-full"
                    title="VRE Whitepaper"
                />
            </div>
        </>
    );
}