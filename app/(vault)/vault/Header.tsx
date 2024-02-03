import Image from "next/image";
import Logo from "../../../public/logos/logo-text.svg";

import SearchSVG from "../../../components/SVGS/SearchSVG";

type HeaderParameters = {
    vaultName: string;
}

const Header = ({ vaultName }: HeaderParameters) => {
    // TODO: getServerSideProps get vault image
    // TODO: Search bar implementation
    return <header className="flex h-14 px-8 py-2.5 bg-white border-b border-gray justify-between flex-shrink-0 flex-grow-0 items-center">
        <div className="flex items-center justify-center space-x-2 flex-shrink-0 select-none">
            <Image src={Logo} alt="Logo with text" height={28} priority={true} className="pointer-events-none" />
            <div className="font-inter text-base italic font-semibold text-sub align-top pl-5 pr-3 py-1 select-none">/</div>
            <div className="font-mono tracking-tight text-base font-semibold text-sub align-top hover:bg-light-gray px-3 py-1 rounded-md cursor-pointer">{vaultName}</div>
        </div>
        <div className="flex">
            <div className="w-full flex items-center justify-end border border-gray rounded-lg px-3 py-1 cursor-pointer select-none">
                { false && "TODO: Add search functionality" }
                <div className="relative w-6 h-6 flex-shrink-0">
                    <SearchSVG name="Search" strokeWidth={2} className="text-sub" />
                </div>
                <div className="font-inter text-quiet ml-2 mr-14 text-ellipsis whitespace-nowrap text-sm">Search for items</div>
            </div>
        </div>
    </header>
}

export default Header;