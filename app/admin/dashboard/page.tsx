import { Metadata } from "next";
import DashboardControls from "./DashboardControls";

export const metadata: Metadata = {
    title: "Web Vault Dashboard",
    robots: {
        index: false,
        follow: false
    }
}

const Dashboard = () => {
    return <main className="px-6 py-5">
        <h1 className="text-2xl font-inter font-bold pb-5">Dashboard</h1>
        <DashboardControls />
    </main>
}

export default Dashboard;