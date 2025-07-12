import { ethers } from "hardhat";

async function main() {
  const FileVault = await ethers.getContractFactory("FileVault");
  const fileVault = await FileVault.deploy();
  await fileVault.waitForDeployment();
  console.log("FileVault deployed to:", fileVault.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});