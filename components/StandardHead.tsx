import Head from "next/head";

type StandardHeadParameters = {
    title: string;
    description?: string;
    noIndex?: boolean;
}

const StandardHead = ({ title, description, noIndex }: StandardHeadParameters) => {
    return <>
        <Head>
            <title>{ title }</title>
            { description && <meta name="description" content={description} /> }
            { noIndex && <meta name="robots" content="noindex, nofollow" /> }
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="../logos/favicon-32.ico" />
        </Head>
    </>
}

export default StandardHead;