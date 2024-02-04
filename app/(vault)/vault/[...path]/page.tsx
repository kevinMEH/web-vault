import { Metadata } from "next";
import Vault from "./Vault";

type PageParams = {
    params: {
        path: string[]
    }
}

export function generateMetadata({ params }: PageParams): Metadata {
    return {
        title: params.path[0],
        robots: {
            index: false,
            follow: false
        }
    };
}

const Page = ({ params: { path } }: PageParams) => {
    const decodedPath = [] as string[];
    for(const string of path) {
        decodedPath.push(string.split("%20").join(" "));
    }
    return <Vault path={decodedPath} />
}

export default Page;