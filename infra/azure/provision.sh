#!/usr/bin/env bash
# Creates the Azure resources for Courseway. Run from a shell where `az login` has been done.
#   ./infra/azure/provision.sh
set -euo pipefail

RG="${RG:-courseway-rg}"
LOCATION="${LOCATION:-northeurope}"
VM="${VM:-courseway-vm}"
SIZE="${SIZE:-Standard_B2s}"
# Must be globally unique within the region: becomes <label>.<region>.cloudapp.azure.com
DNS_LABEL="${DNS_LABEL:-courseway-$RANDOM}"

az group create --name "$RG" --location "$LOCATION" -o none

az vm create \
  --resource-group "$RG" --name "$VM" \
  --image Ubuntu2204 --size "$SIZE" \
  --admin-username azureuser --generate-ssh-keys \
  --public-ip-sku Standard --public-ip-address-dns-name "$DNS_LABEL" \
  --custom-data "$(dirname "$0")/cloud-init.yaml" \
  -o none

az vm open-port --resource-group "$RG" --name "$VM" --port 80  --priority 900 -o none
az vm open-port --resource-group "$RG" --name "$VM" --port 443 --priority 901 -o none

FQDN="$DNS_LABEL.$LOCATION.cloudapp.azure.com"
echo
echo "VM ready.  SSH:  ssh azureuser@$FQDN"
echo "Set DOMAIN=$FQDN in the .env file on the VM."
