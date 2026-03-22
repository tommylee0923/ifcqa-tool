from infrastructure.ifc_reader import load_ifc_elements

def main():

    elements = load_ifc_elements("samples/test.ifc")

    print(f"Loaded {len(elements)} elements")

    for e in elements[:5]:
        print(e)
     
if __name__ == "__main__":
    main()